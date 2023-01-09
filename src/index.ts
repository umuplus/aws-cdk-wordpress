import { AdvancedProps, DatabaseCredentials, Preset } from './utils/types'
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns'
import { AuroraMysqlEngineVersion, Credentials, DatabaseCluster, DatabaseClusterEngine } from 'aws-cdk-lib/aws-rds'
import { Construct } from 'constructs'
import { ContainerImage } from 'aws-cdk-lib/aws-ecs'
import { FileSystem } from 'aws-cdk-lib/aws-efs'
import { HostedZone } from 'aws-cdk-lib/aws-route53'
import { InstanceClass, InstanceSize, InstanceType, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2'
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'

export interface WordpressProps {
    readonly domainName: string
    readonly databaseCredentials?: DatabaseCredentials
    readonly username?: string
    readonly preset?: Preset
    readonly advanced?: AdvancedProps
}

export class Wordpress extends Construct {
    constructor(scope: Construct, id: string, props: WordpressProps) {
        super(scope, id)

        const { databaseCredentials, domainName } = props
        const databaseName = databaseCredentials?.name || 'wordpress'
        const tablePrefix = databaseCredentials?.tablePrefix || 'wp_'
        const databaseUsername = databaseCredentials?.username || 'wp_user'

        const username = props.username || 'user'
        const volume = 'WordpressVolume-' + id
        const containerPath = '/bitnami/wordpress'

        const maximumAvailabilityZones = props.advanced?.maximumAvailabilityZones || 1
        const natGateways = props.advanced?.natGateways || 1
        const taskCPU = props.advanced?.taskCPU || 256
        const taskMemory = props.advanced?.taskMemory || 1024
        const desiredTaskInstanceCount = props.advanced?.desiredTaskInstanceCount || 1
        const cpuThreshold = props.advanced?.cpuThreshold || 85
        const memoryThreshold = props.advanced?.memoryThreshold || 85
        const minCapacity = props.advanced?.minCapacity || 1
        const maxCapacity = props.advanced?.maxCapacity || 1

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
            cpu: taskCPU,
            memoryLimitMiB: taskMemory,
            vpc,
            taskSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
            desiredCount: desiredTaskInstanceCount,
            publicLoadBalancer: true,
            // domainName,
            // domainZone: domainName ? HostedZone.fromLookup(this, 'WordpressDomain-' + id, { domainName }) : undefined,
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
