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
