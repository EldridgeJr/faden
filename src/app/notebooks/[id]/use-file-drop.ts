"use client";

import { useState, type DragEvent } from "react";

// Drag and drop of files onto an element.
// Returns "dragging" (to show a highlight) and the event handlers to spread
// onto the element: <div {...handlers}>.
export function useFileDrop(onFiles: (files: File[]) => void, disabled = false) {
  const [dragging, setDragging] = useState(false);

  // Only react to files, not to dragged text or links.
  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");

  const handlers = {
    onDragOver(event: DragEvent) {
      if (disabled || !hasFiles(event)) return;
      // Without preventDefault() the browser does not allow a drop here.
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDragging(true);
    },
    onDragLeave(event: DragEvent) {
      // dragleave also fires when the pointer moves onto a child element.
      // Only stop when it really leaves the element.
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setDragging(false);
    },
    onDrop(event: DragEvent) {
      if (disabled || !hasFiles(event)) return;
      // Stop the browser from opening the file in the tab.
      event.preventDefault();
      setDragging(false);
      onFiles([...event.dataTransfer.files]);
    },
  };

  return { dragging, handlers };
}
