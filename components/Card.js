import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const Card = ({ title, summary, onAddPress, onViewPress }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSummary}>{summary}</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={onAddPress}>
          <Text style={styles.cardButton}>Add New</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onViewPress}>
          <Text style={styles.cardButton}>View All</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '90%',
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardSummary: {
    fontSize: 16,
    color: '#777',
    marginVertical: 10,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardButton: {
    color: '#1e90ff',
    fontSize: 16,
  },
});

export default Card;
