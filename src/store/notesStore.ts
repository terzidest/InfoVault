import { create } from 'zustand';
import {
  saveToSecureStore,
  getFromSecureStore,
  deleteFromSecureStore,
  getAllItemsByType,
} from '../services/secureStorage';
import { generateSecureId } from '../utils/crypto';
import { createOpTracker } from './opTracker';
import type { Note, NoteInput, NoteCategory } from '../types/models';

interface NotesState {
  notes: Note[];
  categories: NoteCategory[];
  isLoading: boolean;
  error: string | null;
  loadNotes: () => Promise<Note[]>;
  addNote: (note: NoteInput) => Promise<Note>;
  updateNote: (id: string, updatedData: Partial<Note>) => Promise<Note>;
  deleteNote: (id: string) => Promise<boolean>;
  getNoteById: (id: string) => Note | undefined;
  addCategory: (category: NoteCategory) => boolean;
  clearNotes: () => void;
}

const DEFAULT_CATEGORIES: NoteCategory[] = ['Personal', 'Work', 'Financial', 'Health', 'Other'];

const ops = createOpTracker();

const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  categories: DEFAULT_CATEGORIES,
  isLoading: false,
  error: null,

  loadNotes: async () => {
    ops.begin(set);
    try {
      const notes = await getAllItemsByType<Note>('note');
      // Custom categories have no storage of their own — each note carries
      // its category, so rebuild the list from defaults plus what's in use.
      // A custom category with no saved note is intentionally ephemeral.
      const inUse = new Set(notes.map((note) => note.category));
      const categories = [
        ...DEFAULT_CATEGORIES,
        ...[...inUse].filter((c) => c && !DEFAULT_CATEGORIES.includes(c)),
      ];
      set({ notes, categories });
      return notes;
    } catch (error) {
      console.error('Error loading notes:', error);
      set({ error: error instanceof Error ? error.message : String(error) });
      return [];
    } finally {
      ops.end(set);
    }
  },

  addNote: async (note) => {
    ops.begin(set);
    try {
      const id = generateSecureId();
      const now = new Date().toISOString();

      const newNote: Note = {
        id,
        ...note,
        category: note.category || 'Personal',
        createdAt: now,
        updatedAt: now,
      };

      await saveToSecureStore(id, newNote, 'note');

      const notes = [...get().notes, newNote];
      set({ notes });

      return newNote;
    } catch (error) {
      console.error('Error adding note:', error);
      set({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      ops.end(set);
    }
  },

  updateNote: async (id, updatedData) => {
    ops.begin(set);
    try {
      const existingNote = await getFromSecureStore<Note>(id);

      if (!existingNote) {
        throw new Error('Note not found');
      }

      const updatedNote: Note = {
        ...existingNote,
        ...updatedData,
        updatedAt: new Date().toISOString(),
      };

      await saveToSecureStore(id, updatedNote, 'note');

      const notes = get().notes.map((note) =>
        note.id === id ? { ...note, ...updatedNote } : note
      );

      set({ notes });

      return updatedNote;
    } catch (error) {
      console.error('Error updating note:', error);
      set({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      ops.end(set);
    }
  },

  deleteNote: async (id) => {
    ops.begin(set);
    try {
      await deleteFromSecureStore(id, 'note');

      const notes = get().notes.filter((note) => note.id !== id);
      set({ notes });

      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      set({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      ops.end(set);
    }
  },

  getNoteById: (id) => {
    return get().notes.find((note) => note.id === id);
  },

  addCategory: (category) => {
    if (!category || get().categories.includes(category)) {
      return false;
    }

    set({ categories: [...get().categories, category] });
    return true;
  },

  clearNotes: () => {
    set({ notes: [], categories: DEFAULT_CATEGORIES, error: null });
  },
}));

export default useNotesStore;
