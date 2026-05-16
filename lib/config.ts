import { EMERGENCY_MODE } from './emergencyConfig';

const AWS_URL = process.env.NEXT_PUBLIC_AWS_API_URL;
const GCP_URL = process.env.NEXT_PUBLIC_GCP_API_URL;

/**
 * Dynamic API Base URL
 *
 * When EMERGENCY_MODE is active, routes to the AWS Lightsail backend.
 * Otherwise, uses the GCP backend (or falls back to localhost for local dev).
 */
export const API_BASE_URL = EMERGENCY_MODE
  ? (AWS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000')
  : (GCP_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000');