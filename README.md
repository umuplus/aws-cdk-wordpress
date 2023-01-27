# AWS CDK Wordpress

This construct extends an existing CDK stack and adds resources to deploy a highly scalable Wordpress application.

> It's still under development.

## Options

There are three different set of options: Wordpress, Scaling and Cache.

### Wordpress Configuration

Parameter       | Type          | Required  | Default   | Description
--------------- | ------------- | --------- | --------- | -------------------------
username        | string        | false     | user      | Administrator's username
dbInstanceType  | InstanceType  | false     | t2.micro  | Database instance type

### Scaling Configuration

```typescript
export interface ScalingProps {
    readonly maximumAvailabilityZones?: number
    readonly natGateways?: number
    readonly taskCpu?: number
    readonly taskMemory?: number
    readonly desiredTaskInstanceCount?: number
    readonly cpuThreshold?: number
    readonly memoryThreshold?: number
    readonly minCapacity?: number
    readonly maxCapacity?: number
}
```

Parameter                 | Type      | Required  | Default   | Description         |
------------------------- | --------- | --------- | --------- | ------------------- |
maximumAvailabilityZones  | number    | false     | 1         | Max. number of availability zones for the VPC
natGateways               | number    | false     | 1         | Number of nat gateways for the VPC
taskCpu                   | number    | false     | 256       | CPU parameter for Fargate Task
taskMemory                | number    | false     | 512       | Memory parameter for Fargate Task
desiredTaskInstanceCount  | number    | false     | 1         | Desired instance count parameter for Fargate Task
cpuThreshold              | number    | false     | 90        | CPU parameter for auto scaling rule of the Fargate Task
memoryThreshold           | number    | false     | 90        | Memory parameter for auto scaling rule of the Fargate Task
minCapacity               | number    | false     | 1         | Min. number of instances for auto scaling rule of the Fargate Task
maxCapacity               | number    | false     | 1         | Max. number of instances for auto scaling rule of the Fargate Task

### Cache Configuration

Cache is disabled by default. If you want to enable it with default configuration, you can simply set **cache** parameter to **true**.

```typescript
export interface ScalingProps {
    readonly cacheNodeType?: InstanceType
    readonly numberOfCacheNodes?: number
}
```

Parameter           | Type      | Required  | Default   | Description         |
------------------- | --------- | --------- | --------- | ------------------- |
cacheNodeType       | number    | false     | t2.micro  | Cache node instance type
numberOfCacheNodes  | number    | false     | 1         | Number of cache nodes
