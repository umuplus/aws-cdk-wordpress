import { InstanceType } from "aws-cdk-lib/aws-ec2"

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

export interface CacheProps {
    readonly cacheNodeType?: InstanceType
    readonly numberOfCacheNodes?: number
}
