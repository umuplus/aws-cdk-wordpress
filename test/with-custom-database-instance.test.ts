import { App, Stack } from 'aws-cdk-lib'
import { InstanceClass, InstanceSize, InstanceType } from 'aws-cdk-lib/aws-ec2'
import { Template } from 'aws-cdk-lib/assertions'
import { Wordpress } from '../src/index'
import '@aws-cdk/assert/jest'

test('basic wordpress stack with custom database instance', () => {
    const app = new App()
    const stack = new Stack(app, 'MyTestStack2')
    new Wordpress(stack, 'MyWP2', {
        dbInstanceType: InstanceType.of(InstanceClass.T3, InstanceSize.SMALL),
    })
    const template = Template.fromStack(stack)
    template.resourceCountIs('AWS::RDS::DBInstance', 2)

    template.hasResource('AWS::RDS::DBInstance', {
        Properties: {
            DBInstanceClass: 'db.t3.small',
            Engine: 'aurora-mysql',
            PubliclyAccessible: false,
        },
    })
})
