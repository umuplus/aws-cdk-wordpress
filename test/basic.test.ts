import { App, Stack } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { Wordpress } from '../src/index'
import '@aws-cdk/assert/jest'

test('basic wordpress stack', () => {
    const app = new App()
    const stack = new Stack(app, 'MyTestStack')
    new Wordpress(stack, 'MyWP')
    const template = Template.fromStack(stack)
    template.resourceCountIs('AWS::IAM::Role', 2)
    template.resourceCountIs('AWS::EC2::VPC', 1)
    template.resourceCountIs('AWS::EC2::Subnet', 2)
    template.resourceCountIs('AWS::EC2::EIP', 1)
    template.resourceCountIs('AWS::EC2::NatGateway', 1)
    template.resourceCountIs('AWS::EC2::InternetGateway', 1)
    template.resourceCountIs('AWS::EC2::SecurityGroup', 4)
    template.resourceCountIs('AWS::SecretsManager::Secret', 2)
    template.resourceCountIs('AWS::RDS::DBCluster', 1)
    template.resourceCountIs('AWS::RDS::DBInstance', 2)
    template.resourceCountIs('AWS::EFS::FileSystem', 1)
    template.resourceCountIs('AWS::ECS::Cluster', 1)
    template.resourceCountIs('AWS::ECS::TaskDefinition', 1)
    template.resourceCountIs('AWS::ApplicationAutoScaling::ScalableTarget', 1)
    template.resourceCountIs('AWS::CloudFront::Distribution', 1)

    template.hasResource('AWS::IAM::Role', {
        Properties: {
            AssumeRolePolicyDocument: {
                Statement: [
                    { Action: 'sts:AssumeRole', Effect: 'Allow', Principal: { Service: 'ecs-tasks.amazonaws.com' } },
                ],
            },
        },
    })
    template.hasResource('AWS::EC2::VPC', {
        Properties: {
            CidrBlock: '10.0.0.0/16',
            EnableDnsHostnames: true,
            EnableDnsSupport: true,
            InstanceTenancy: 'default',
        },
    })
    template.hasResource('AWS::EC2::Subnet', {
        Properties: {
            CidrBlock: '10.0.1.0/24',
            MapPublicIpOnLaunch: false,
        },
    })
    template.hasResource('AWS::EC2::Subnet', {
        Properties: {
            CidrBlock: '10.0.0.0/24',
            MapPublicIpOnLaunch: true,
        },
    })
    template.hasResource('AWS::EC2::EIP', {
        Properties: {
            Domain: 'vpc',
        },
    })
    template.hasResource('AWS::SecretsManager::Secret', {
        Properties: {
            Name: 'password-of-wp_user',
            GenerateSecretString: { PasswordLength: 20, ExcludePunctuation: true },
        },
    })
    template.hasResource('AWS::SecretsManager::Secret', {
        Properties: {
            Name: 'password-of-user',
            GenerateSecretString: { PasswordLength: 20, ExcludePunctuation: true },
        },
    })
    template.hasResource('AWS::RDS::DBCluster', {
        Properties: {
            CopyTagsToSnapshot: true,
            DBClusterParameterGroupName: 'default.aurora-mysql5.7',
            DatabaseName: 'wordpress',
            Engine: 'aurora-mysql',
            EngineVersion: '5.7.mysql_aurora.2.10.3',
            MasterUsername: 'wp_user',
        },
    })
    template.hasResource('AWS::RDS::DBInstance', {
        Properties: {
            DBInstanceClass: 'db.t2.micro',
            Engine: 'aurora-mysql',
            PubliclyAccessible: false,
        },
    })
    template.hasResource('AWS::EFS::FileSystem', {
        Properties: {
            Encrypted: true,
        },
    })
    template.hasResource('AWS::ECS::TaskDefinition', {
        Properties: {
            ContainerDefinitions: [
                {
                    Essential: true,
                    Image: 'bitnami/wordpress:latest',
                    LogConfiguration: {
                        LogDriver: 'awslogs',
                        Options: {
                            'awslogs-region': { Ref: 'AWS::Region' },
                            'awslogs-stream-prefix': 'WordpressApp-MyWP',
                        },
                    },
                    MountPoints: [
                        { ContainerPath: '/bitnami/wordpress', ReadOnly: false, SourceVolume: 'WordpressVolume-MyWP' },
                    ],
                    Name: 'web',
                    PortMappings: [{ ContainerPort: 80, Protocol: 'tcp' }],
                },
            ],
            Cpu: '256',
            Memory: '512',
            NetworkMode: 'awsvpc',
            RequiresCompatibilities: ['FARGATE'],
            Volumes: [{ Name: 'WordpressVolume-MyWP' }],
        },
    })
    template.hasResource('AWS::ApplicationAutoScaling::ScalableTarget', {
        Properties: {
            MaxCapacity: 1,
            MinCapacity: 1,
            ScalableDimension: 'ecs:service:DesiredCount',
            ServiceNamespace: 'ecs',
        },
    })
})
