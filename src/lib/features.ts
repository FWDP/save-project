// Opt in explicitly so local and cloud builds keep Stellar paused by default.
export const stellarEnabled = process.env.EXPO_PUBLIC_STELLAR_ENABLED === 'true';
