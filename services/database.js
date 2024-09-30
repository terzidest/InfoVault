import * as SQLite from 'expo-sqlite/legacy';

const db = SQLite.openDatabase('notes.db');

export const initializeDatabase = () => {
  db.transaction(tx => {
    tx.executeSql(
      'CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT);'
    );
  });
};

export const addNote = (title, content) => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'INSERT INTO notes (title, content) VALUES (?, ?);',
        [title, content],
        (_, result) => resolve(result),
        (_, error) => reject(error)
      );
    });
  });
};

export const getNotes = () => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM notes;',
        [],
        (_, { rows: { _array } }) => resolve(_array),
        (_, error) => reject(error)
      );
    });
  });
};

export const getNoteById = (id) => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM notes WHERE id = ?;',
        [id],
        (_, { rows: { _array } }) => resolve(_array[0]),
        (_, error) => reject(error)
      );
    });
  });
};

export const updateNote = (id, title, content) => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'UPDATE notes SET title = ?, content = ? WHERE id = ?;',
        [title, content, id],
        (_, result) => resolve(result),
        (_, error) => reject(error)
      );
    });
  });
};

export const deleteNote = (id) => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM notes WHERE id = ?;',
        [id],
        (_, result) => resolve(result),
        (_, error) => reject(error)
      );
    });
  });
};
