import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, TouchableOpacity, Text, StyleSheet, StatusBar, Platform } from 'react-native';
import LoadingScreen from './LoadingScreen';
import CompraForm from './CompraForm';
import DashBoard from './DashBoard';

const App = () => {
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState<'form' | 'dashboard'>('form');

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Garante que a barra de status fique visível e escura */}
            <StatusBar
                barStyle="light-content"
                backgroundColor="#000"
                translucent={false}
            />
            {/* Navegação entre views */}
            <View style={styles.navigation}>
                <TouchableOpacity 
                    style={[styles.navButton, currentView === 'form' && styles.activeButton]} 
                    onPress={() => setCurrentView('form')}
                >
                    <Text style={[styles.navText, currentView === 'form' && styles.activeText]}>Nova Compra</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.navButton, currentView === 'dashboard' && styles.activeButton]} 
                    onPress={() => setCurrentView('dashboard')}
                >
                    <Text style={[styles.navText, currentView === 'dashboard' && styles.activeText]}>Dashboard</Text>
                </TouchableOpacity>
            </View>

            {currentView === 'form' ? <CompraForm /> : <DashBoard />}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#000',
    },
    navigation: {
        flexDirection: 'row',
        backgroundColor: '#111',
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    navButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        marginHorizontal: 5,
        borderRadius: 8,
    },
    activeButton: {
        backgroundColor: '#014421',
    },
    navText: {
        color: '#aaa',
        fontSize: 16,
        fontWeight: 'bold',
    },
    activeText: {
        color: '#fff',
    },
});

export default App;
