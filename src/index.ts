import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns'
import { AuroraMysqlEngineVersion, Credentials, DatabaseCluster, DatabaseClusterEngine } from 'aws-cdk-lib/aws-rds'
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { ContainerImage } from 'aws-cdk-lib/aws-ecs'
import { FileSystem } from 'aws-cdk-lib/aws-efs'
import { InstanceClass, InstanceSize, InstanceType, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2'
import { ScalingProps } from './utils/types'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'

export interface WordpressProps {
    readonly username?: string
    readonly scaling?: ScalingProps
}

export class Wordpress extends Construct {
    constructor(scope: Construct, id: string, props?: WordpressProps) {
        super(scope, id)

        const { scaling } = props || {}
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
            ]
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
        const instanceType = InstanceType.of(InstanceClass.R5, InstanceSize.LARGE)
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
            if (cpuThreshold > 0)
                targetScaling.scaleOnCpuUtilization('WordpressCPUScaling-' + id, {
                    targetUtilizationPercent: cpuThreshold,
                })
            if (memoryThreshold > 0)
                targetScaling.scaleOnMemoryUtilization('WordpressMemoryScaling-' + id, {
                    targetUtilizationPercent: memoryThreshold,
                })
        }

        const dbHostOutput = 'WordpressDBHost-' + id
        new CfnOutput(this, dbHostOutput, { exportName: dbHostOutput, value: db.clusterEndpoint.hostname })

        const wpPasswordOutput = 'WordpressPassword-' + id
        new CfnOutput(this, wpPasswordOutput, { exportName: wpPasswordOutput, value: secretWP.secretValue.toString() })
    }
}
