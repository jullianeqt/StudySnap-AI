import React from 'react';
import { matchOffsets } from '../search';
import type { ReviewerSearch } from '../search';

interface HighlightProps {
  text: string;
  /** Stable field path from the search index (see search.ts). */
  path: string;
  search?: ReviewerSearch;
}

/**
 * Renders text with every search match wrapped in an accessible <mark>.
 * The focused match gets the accent treatment; matches are scroll-margin
 * aware so prev/next navigation clears the sticky control bar.
 */
export const Highlight: React.FC<HighlightProps> = ({ text, path, search }) => {
  const query = search?.query ?? '';
  if (!query || !search) return <>{text}</>;

  const entry = search.entries.get(path);
  if (!entry || entry.count === 0) return <>{text}</>;

  const offsets = matchOffsets(text, query, entry.count);
  if (offsets.length === 0) return <>{text}</>;

  const length = query.length;
  const nodes: React.ReactNode[] = [];
  let position = 0;

  offsets.forEach((start, i) => {
    if (start > position) nodes.push(text.slice(position, start));
    const global = entry.offset + i;
    const isCurrent = global === search.current;
    nodes.push(
      <mark
        key={start}
        data-review-match={global}
        className={`rounded-sm px-0.5 scroll-mt-28 ${
          isCurrent ? 'bg-accent text-white' : 'bg-amber-soft text-ink'
        }`}
      >
        {text.slice(start, start + length)}
      </mark>,
    );
    position = start + length;
  });

  if (position < text.length) nodes.push(text.slice(position));
  return <>{nodes}</>;
};
