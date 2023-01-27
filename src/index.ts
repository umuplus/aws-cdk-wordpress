import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns'
import { AuroraMysqlEngineVersion, Credentials, DatabaseCluster, DatabaseClusterEngine } from 'aws-cdk-lib/aws-rds'
import { CacheProps, ScalingProps } from './utils/types'
import { CfnCacheCluster, CfnSubnetGroup } from 'aws-cdk-lib/aws-elasticache'
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import { CloudFrontWebDistribution, OriginProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront'
import { Construct } from 'constructs'
import { ContainerImage } from 'aws-cdk-lib/aws-ecs'
import { FileSystem } from 'aws-cdk-lib/aws-efs'
import {
    InstanceClass,
    InstanceSize,
    InstanceType,
    SubnetType,
    Vpc,
} from 'aws-cdk-lib/aws-ec2'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'

export interface WordpressProps {
    readonly username?: string
    readonly dbInstanceType?: InstanceType
    readonly cache?: CacheProps | boolean
    readonly scaling?: ScalingProps
}

export class Wordpress extends Construct {
    constructor(scope: Construct, id: string, props?: WordpressProps) {
        super(scope, id)

        const { cache, dbInstanceType, scaling } = props || {}
        const databaseName = 'wordpress'
        const tablePrefix = 'wp_'
        const databaseUsername = 'wp_user'

        const username = props?.username || 'user'
        const volume = 'WordpressVolume-' + id
        const containerPath = '/bitnami/wordpress'

        const maximumAvailabilityZones = scaling?.maximumAvailabilityZones || 1
        const natGateways = scaling?.natGateways || 1
        const taskCpu = scaling?.taskCpu || 256
        const taskMemory = scaling?.taskMemory || 512
        const desiredTaskInstanceCount = scaling?.desiredTaskInstanceCount || 1
        const cpuThreshold = scaling?.cpuThreshold || 90
        const memoryThreshold = scaling?.memoryThreshold || 90
        const minCapacity = scaling?.minCapacity || 1
        const maxCapacity = scaling?.maxCapacity || 1

        const vpc = new Vpc(this, 'WordpressVPC-' + id, {
            maxAzs: maximumAvailabilityZones,
            natGateways,
            subnetConfiguration: [
                { name: 'public', subnetType: SubnetType.PUBLIC, cidrMask: 24 },
                { name: 'privateIsolated', subnetType: SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
            ],
        })

        const secretDB = new Secret(this, 'WordpressDBSecret-' + id, {
            secretName: `password-of-${databaseUsername}`,
            generateSecretString: { passwordLength: 20, excludePunctuation: true },
            removalPolicy: RemovalPolicy.DESTROY,
        })
        const secretWP = new Secret(this, 'WordpressSecret-' + id, {
            secretName: `password-of-${username}`,
            generateSecretString: { passwordLength: 20, excludePunctuation: true },
            removalPolicy: RemovalPolicy.DESTROY,
        })

        const instanceType = dbInstanceType || InstanceType.of(InstanceClass.T2, InstanceSize.MICRO)
        const db = new DatabaseCluster(this, 'WordpressDB-' + id, {
            engine: DatabaseClusterEngine.auroraMysql({ version: AuroraMysqlEngineVersion.VER_2_10_3 }),
            instanceProps: { instanceType, vpc, vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED } },
            credentials: Credentials.fromPassword(databaseUsername, secretDB.secretValue),
            defaultDatabaseName: databaseName,
            removalPolicy: RemovalPolicy.DESTROY,
        })

        const fs = new FileSystem(this, 'WordpressFS-' + id, {
            vpc,
            fileSystemName: `${databaseName}-${id}`,
            vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
            removalPolicy: RemovalPolicy.DESTROY,
        })

        let redis: CfnCacheCluster | undefined = undefined
        if (cache) {
            let cacheNodeType = `cache.${InstanceType.of(InstanceClass.T2, InstanceSize.MICRO).toString()}`
            if (typeof cache !== 'boolean' && cache?.cacheNodeType)
                cacheNodeType = `cache.${cache.cacheNodeType.toString()}`
            let numberOfCacheNodes = 1
            if (typeof cache !== 'boolean' && cache?.numberOfCacheNodes) numberOfCacheNodes = cache.numberOfCacheNodes

            const subnetGroup = new CfnSubnetGroup(this, 'WordpressRedisPSG-' + id, {
                subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),
                description: 'Private subnet group for Redis Cluster',
            })
            redis = new CfnCacheCluster(this, `WordpressRedisCluster-` + id, {
                engine: 'redis',
                cacheNodeType,
                numCacheNodes: numberOfCacheNodes,
                vpcSecurityGroupIds: [vpc.vpcDefaultSecurityGroup],
                cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
            })
            redis.addDependency(subnetGroup)
        }

        const wp = new ApplicationLoadBalancedFargateService(this, 'WordpressApp-' + id, {
            taskImageOptions: {
                image: ContainerImage.fromRegistry('bitnami/wordpress:latest'),
                environment: {
                    // ! https://gallery.ecr.aws/bitnami/wordpress
                    WORDPRESS_DATABASE_NAME: databaseName,
                    WORDPRESS_DATABASE_USER: databaseUsername,
                    WORDPRESS_DATABASE_PASSWORD: secretDB.secretValue.toString(),
                    WORDPRESS_DATABASE_HOST: db.clusterEndpoint.hostname,
                    WORDPRESS_TABLE_PREFIX: tablePrefix,
                    WORDPRESS_PASSWORD: secretWP.secretValue.toString(),
                },
            },
            cpu: taskCpu,
            memoryLimitMiB: taskMemory,
            vpc,
            taskSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
            desiredCount: desiredTaskInstanceCount,
            publicLoadBalancer: true,
        })

        db.connections.allowDefaultPortFrom(wp.service.connections)
        fs.connections.allowDefaultPortFrom(wp.service.connections)
        wp.taskDefinition.addVolume({ efsVolumeConfiguration: { fileSystemId: fs.fileSystemId }, name: volume })
        wp.taskDefinition.defaultContainer?.addMountPoints({ containerPath, readOnly: false, sourceVolume: volume })
        wp.targetGroup.configureHealthCheck({ path: '/', healthyHttpCodes: '200-399' })
        if (minCapacity || maxCapacity) {
            const targetScaling = wp.service.autoScaleTaskCount({ minCapacity, maxCapacity })
            if (maxCapacity > desiredTaskInstanceCount) {
                if (cpuThreshold > 0)
                    targetScaling.scaleOnCpuUtilization('WordpressCPUScaling-' + id, {
                        targetUtilizationPercent: cpuThreshold,
                    })
                if (memoryThreshold > 0)
                    targetScaling.scaleOnMemoryUtilization('WordpressMemoryScaling-' + id, {
                        targetUtilizationPercent: memoryThreshold,
                    })
            }
        }

        const cloudfront = new CloudFrontWebDistribution(this, 'WordpressDistribution-' + id, {
            originConfigs: [
                {
                    customOriginSource: {
                        domainName: wp.loadBalancer.loadBalancerDnsName,
                        originProtocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
                    },
                    behaviors: [{ isDefaultBehavior: true }],
                },
            ],
        })

        const wpUrl = 'WordpressUrl-' + id
        new CfnOutput(this, wpUrl, { exportName: wpUrl, value: cloudfront.distributionDomainName })

        const dbHostOutput = 'WordpressDBHost-' + id
        new CfnOutput(this, dbHostOutput, { exportName: dbHostOutput, value: db.clusterEndpoint.hostname })

        const wpPasswordOutput = 'WordpressPassword-' + id
        new CfnOutput(this, wpPasswordOutput, { exportName: wpPasswordOutput, value: secretWP.secretValue.toString() })

        if (redis) {
            const wpRedisHost = 'WordpressRedisHost-' + id
            new CfnOutput(this, wpRedisHost, { exportName: wpRedisHost, value: redis.attrRedisEndpointAddress })
            const wpRedisPort = 'WordpressRedisPort-' + id
            new CfnOutput(this, wpRedisPort, { exportName: wpRedisPort, value: redis.attrRedisEndpointPort })
        }
    }
}
