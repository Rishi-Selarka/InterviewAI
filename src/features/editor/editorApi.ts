// A tiny imperative bridge so sibling panels (Run button, Problem panel) can talk
// to the live Monaco/Yjs editor without prop-drilling the editor instance around.
//
// RoomLayout creates a ref of this shape; CollaborativeEditor fills it in once the
// editor mounts; other panels read/write through it.

export interface EditorApi {
  /** Current shared editor contents. */
  getCode: () => string;
  /**
   * Replace the entire shared document with `code`. Because it writes through the
   * Yjs text, the change propagates live to every connected participant.
   */
  loadCode: (code: string) => void;
}
