import { App, Stack } from 'aws-cdk-lib'
import { InstanceClass, InstanceSize, InstanceType } from 'aws-cdk-lib/aws-ec2'
import { Template } from 'aws-cdk-lib/assertions'
import { Wordpress } from '../src/index'
import '@aws-cdk/assert/jest'

test('advanced wordpress stack with default cache support', () => {
    const app = new App()
    const stack = new Stack(app, 'MyTestStack3')
    new Wordpress(stack, 'MyWP3', {
        cache: true,
        dbInstanceType: InstanceType.of(InstanceClass.T3, InstanceSize.SMALL),
    })
    const template = Template.fromStack(stack)
    template.resourceCountIs('AWS::ElastiCache::SubnetGroup', 1)
    template.resourceCountIs('AWS::ElastiCache::CacheCluster', 1)

    template.hasResource('AWS::ElastiCache::CacheCluster', {
        Properties: {
            CacheNodeType: 'cache.t2.micro',
            Engine: 'redis',
            NumCacheNodes: 1,
        },
    })
})
