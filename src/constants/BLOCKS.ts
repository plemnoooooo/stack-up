export enum MOVING {
    STARTING_SPEED = 0.12,
    MAX_SPEED = 0.48,
    SPEED_DECREASE = 0.16,
    SPEED_DECREASE_INTERVAL = 12,
    SPEED_DAMPING = 24,
    RESET_DELAY = 600,

    MIN_X = -12,
    MAX_X = 12,
    MIN_Z = -12,
    MAX_Z = 12
}

export enum CUTOFF {
    GRAVITY = -0.12,
    FADE_OUT_SPEED = 0.036
}