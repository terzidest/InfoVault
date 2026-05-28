import { create } from 'zustand';
import {
  saveToSecureStore,
  getFromSecureStore,
  deleteFromSecureStore,
  getAllItemsByType,
} from '../services/secureStorage';
import { generateSecureId } from '../utils/crypto';
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

const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  categories: ['Personal', 'Work', 'Financial', 'Health', 'Other'],
  isLoading: false,
  error: null,

  loadNotes: async () => {
    set({ isLoading: true, error: null });
    try {
      const notes = await getAllItemsByType<Note>('note');
      set({ notes, isLoading: false });
      return notes;
    } catch (error) {
      console.error('Error loading notes:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      return [];
    }
  },

  addNote: async (note) => {
    set({ isLoading: true, error: null });
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
      set({ notes, isLoading: false });

      return newNote;
    } catch (error) {
      console.error('Error adding note:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      throw error;
    }
  },

  updateNote: async (id, updatedData) => {
    set({ isLoading: true, error: null });
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

      set({ notes, isLoading: false });

      return updatedNote;
    } catch (error) {
      console.error('Error updating note:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      throw error;
    }
  },

  deleteNote: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await deleteFromSecureStore(id, 'note');

      const notes = get().notes.filter((note) => note.id !== id);
      set({ notes, isLoading: false });

      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      throw error;
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
    set({ notes: [], error: null });
  },
}));

export default useNotesStore;
