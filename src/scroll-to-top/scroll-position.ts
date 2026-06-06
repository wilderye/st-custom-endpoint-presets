interface RectLike {
  top: number;
  bottom: number;
}

interface MessageScrollTargetInput {
  currentScrollTop: number;
  chatRect: RectLike;
  messageRect: RectLike;
}

export function getMessageTopScrollTop({ currentScrollTop, chatRect, messageRect }: MessageScrollTargetInput): number {
  return currentScrollTop + messageRect.top - chatRect.top;
}

export function getMessageBottomScrollTop({
  currentScrollTop,
  chatRect,
  messageRect,
}: MessageScrollTargetInput): number {
  return currentScrollTop + messageRect.bottom - chatRect.bottom;
}
