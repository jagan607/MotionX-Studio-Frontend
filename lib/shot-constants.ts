/**
 * Shared constants for shot metadata controls.
 * Used by both SortableShotCard and ImageConfigurationModal.
 */

export const SHOT_TYPE_PRESETS = [
    'Wide Shot',
    'Medium Shot',
    'Close Up',
    'Extreme Close Up',
    'Medium Close Up',
    'Over the Shoulder',
    'POV',
    'Dutch Angle',
    'Aerial / Drone',
    'Tracking Shot',
] as const;

export const CAMERA_ANGLES = [
    { value: 'wide_establishing', label: 'Wide (Establishing)' },
    { value: 'front', label: 'Front' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'back', label: 'Back' },
] as const;
