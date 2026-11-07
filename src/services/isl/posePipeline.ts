/**
 * Experimental MediaPipe Pose / Landmark Recognition Scaffold (vision.md §2E).
 *
 * CRITICAL ARCHITECTURAL CONSTRAINT:
 * Sign language is not simply isolated hand gestures mapped to words.
 * It possesses distinct grammar, facial expression, body movement, spatial
 * orientation, and rich regional variations.
 *
 * Per vision.md §2E:
 * "Do not market a small gesture classifier as a universal sign-language translator."
 *
 * This scaffold stays strictly behind an explicit flag and reports its status
 * honestly as 'experimental'. Camera sign-to-text translation is disabled by default.
 */

export const ISL_EXPERIMENTAL_POSE_PIPELINE_FLAG = false;

export interface PosePipelineStatus {
  enabled: boolean;
  status: 'disabled' | 'experimental';
  claimTranslation: false;
  disclaimer: string;
  notes: string[];
}

/**
 * Returns diagnostic status of the experimental pose recognition pipeline.
 */
export function getPosePipelineStatus(): PosePipelineStatus {
  return {
    enabled: ISL_EXPERIMENTAL_POSE_PIPELINE_FLAG,
    status: ISL_EXPERIMENTAL_POSE_PIPELINE_FLAG ? 'experimental' : 'disabled',
    claimTranslation: false,
    disclaimer:
      'Indian Sign Language cannot be translated by simple gesture classifiers. Real communication requires complete grammatical context, facial morphology, and community partnership (vision.md §2E).',
    notes: [
      'Vision research track only — strictly experimental.',
      'Camera-based recognition is disabled by default.',
      'No claims of automated sign-to-text translation are made.',
    ],
  };
}

/**
 * Evaluates whether camera sign recognition is permissible.
 * Always false in production builds to prevent deceptive AI translation claims.
 */
export function isCameraSignRecognitionAllowed(): boolean {
  return false;
}

