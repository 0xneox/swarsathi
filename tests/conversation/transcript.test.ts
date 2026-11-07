import {
  appendTranscriptEntry,
  clearTranscript,
  createTranscriptEntry,
  removeTranscriptEntry,
  updateTranscriptEntry,
} from '../../src/data/conversation';

describe('conversation transcript', () => {
  it('appends incoming and outgoing turns in order', () => {
    let entries = appendTranscriptEntry([], createTranscriptEntry('incoming', 'Hello'));
    entries = appendTranscriptEntry(entries, createTranscriptEntry('outgoing', 'Hi there'));
    expect(entries.map((e) => e.role)).toEqual(['incoming', 'outgoing']);
    expect(entries[0].text).toBe('Hello');
    expect(entries[1].text).toBe('Hi there');
  });

  it('ignores blank wording so silence never litters the transcript', () => {
    const entries = appendTranscriptEntry([], createTranscriptEntry('incoming', '   '));
    expect(entries).toEqual([]);
  });

  it('lets the user correct a misheard line', () => {
    const entries = appendTranscriptEntry([], createTranscriptEntry('incoming', 'I need watr'));
    const fixed = updateTranscriptEntry(entries, entries[0].id, 'I need water');
    expect(fixed[0].text).toBe('I need water');
    // Other entries are untouched.
    expect(fixed[0].id).toBe(entries[0].id);
  });

  it('removes a single turn and clears the whole transcript', () => {
    let entries = appendTranscriptEntry([], createTranscriptEntry('incoming', 'one'));
    entries = appendTranscriptEntry(entries, createTranscriptEntry('outgoing', 'two'));
    entries = removeTranscriptEntry(entries, entries[0].id);
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('two');
    expect(clearTranscript()).toEqual([]);
  });
});
