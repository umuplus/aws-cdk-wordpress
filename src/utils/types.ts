export enum Preset {
    BASIC = 'basic',
    SMALL_BUSINESS = 'small-business',
    BUSINESS = 'business',
}

export interface DatabaseCredentials {
    readonly name?: string
    readonly tablePrefix?: string
    readonly username?: string
}

export interface AdvancedProps {
    readonly maximumAvailabilityZones?: number
    readonly natGateways?: number
    readonly taskCPU?: number
    readonly taskMemory?: number
    readonly desiredTaskInstanceCount?: number
    readonly cpuThreshold?: number
    readonly memoryThreshold?: number
    readonly minCapacity?: number
    readonly maxCapacity?: number
}
