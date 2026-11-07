import type { Message, MessageSegment, ScriptCode } from '../../types';
import { getScriptForLanguage, transliterate } from './transliterate';

/**
 * Transliterates Latin segments of a structured Message into the target script or language.
 *
 * Honors the requirement:
 * "mark output as transliterated in Message.meta.flags."
 */
export function transliterateMessage(
  message: Message,
  targetScriptOrLanguage: string
): Message {
  const targetScript = getScriptForLanguage(targetScriptOrLanguage);
  if (!targetScript) {
    return message;
  }

  const updatedSegments: MessageSegment[] = message.segments.map((segment) => {
    // Only transliterate Latin segments
    if (segment.script === 'Latn' || !segment.script) {
      const transliterated = transliterate(segment.text, targetScript);
      return {
        ...segment,
        text: transliterated,
        script: targetScript as ScriptCode,
      };
    }
    return segment;
  });

  return {
    ...message,
    segments: updatedSegments,
    meta: {
      ...message.meta,
      updatedAt: Date.now(),
      flags: {
        ...message.meta.flags,
        transliterated: true,
      },
    },
  };
}
