import { create } from 'zustand';
import { 
  saveToSecureStore, 
  getFromSecureStore, 
  deleteFromSecureStore, 
  getAllItemsByType 
} from '../services/secureStorage';
import { generateSecureId } from '../utils/encryption';

/**
 * Notes state management using Zustand
 */
const useNotesStore = create((set, get) => ({
  // State
  notes: [],
  categories: ['Personal', 'Work', 'Financial', 'Health', 'Other'],
  isLoading: false,
  error: null,
  
  // Load all notes
  loadNotes: async () => {
    set({ isLoading: true, error: null });
    try {
      const notes = await getAllItemsByType('note');
      set({ notes, isLoading: false });
      return notes;
    } catch (error) {
      console.error('Error loading notes:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },
  
  // Add new note
  addNote: async (note) => {
    set({ isLoading: true, error: null });
    try {
      // Generate unique ID
      const id = generateSecureId();
      
      // Prepare the note with metadata
      const newNote = {
        id,
        ...note,
        category: note.category || 'Personal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save to secure storage
      await saveToSecureStore(id, newNote, 'note');
      
      // Update state
      const notes = [...get().notes, newNote];
      set({ notes, isLoading: false });
      
      return newNote;
    } catch (error) {
      console.error('Error adding note:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Update existing note
  updateNote: async (id, updatedData) => {
    set({ isLoading: true, error: null });
    try {
      // Get the existing note
      const existingNote = await getFromSecureStore(id);
      
      if (!existingNote) {
        throw new Error('Note not found');
      }
      
      // Merge data and update metadata
      const updatedNote = {
        ...existingNote,
        ...updatedData,
        updatedAt: new Date().toISOString()
      };
      
      // Save to secure storage
      await saveToSecureStore(id, updatedNote, 'note');
      
      // Update state
      const notes = get().notes.map(note => 
        note.id === id ? { ...note, ...updatedNote } : note
      );
      
      set({ notes, isLoading: false });
      
      return updatedNote;
    } catch (error) {
      console.error('Error updating note:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Delete note
  deleteNote: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Delete from secure storage
      await deleteFromSecureStore(id, 'note');
      
      // Update state
      const notes = get().notes.filter(note => note.id !== id);
      set({ notes, isLoading: false });
      
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Get note by ID
  getNoteById: (id) => {
    return get().notes.find(note => note.id === id);
  },
  
  // Add custom category
  addCategory: (category) => {
    if (!category || get().categories.includes(category)) {
      return false;
    }
    
    set({ categories: [...get().categories, category] });
    return true;
  },
  
  // Clear notes state (e.g., on logout)
  clearNotes: () => {
    set({ notes: [], error: null });
  }
}));

export default useNotesStore;
