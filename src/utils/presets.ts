import { Preset } from './types'

export const Presets = {
    [Preset.BASIC]: {
        maximumAvailabilityZones: 1,
        natGateways: 1,
        taskCPU: 256,
        taskMemory: 1024,
        desiredTaskInstanceCount: 1,
        cpuThreshold: 85,
        memoryThreshold: 85,
        minCapacity: 1,
        maxCapacity: 3,
    },
    [Preset.SMALL_BUSINESS]: {
        maximumAvailabilityZones: 2,
        natGateways: 1,
        taskCPU: 1024,
        taskMemory: 2048,
        desiredTaskInstanceCount: 1,
        cpuThreshold: 75,
        memoryThreshold: 75,
        minCapacity: 1,
        maxCapacity: 5,
    },
    [Preset.BUSINESS]: {
        maximumAvailabilityZones: 2,
        natGateways: 1,
        taskCPU: 1024,
        taskMemory: 2048,
        desiredTaskInstanceCount: 2,
        cpuThreshold: 75,
        memoryThreshold: 75,
        minCapacity: 2,
        maxCapacity: 10,
    },
}
