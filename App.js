import { StatusBar } from 'expo-status-bar';
import { Text, View, TouchableOpacity, TextInput } from 'react-native';
import "./global.css"
import LocationTracker from './LocationTracker';
import { useState, useEffect } from 'react';

const API_BASE_URL = 'https://t0tl--gps-backend-fastapi-app.modal.run';

export default function App() {
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [destination, setDestination] = useState('');
  const [navigationId, setNavigationId] = useState(null);
  const [currentInstruction, setCurrentInstruction] = useState(null);
  const [navigationStatus, setNavigationStatus] = useState(null);

  // Start location tracking
  useEffect(() => {
    const tracker = new LocationTracker();
    
    tracker.startTracking()
      .then(position => {
        setLocation(position);
      })
      .catch(error => {
        setLocationError(error.message);
      });

    return () => {
      tracker.stopTracking();
    };
  }, []);

  // Handle location updates when navigation is active
  useEffect(() => {
    if (!navigationId || !location) return;

    const updateInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/location_update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            navigation_id: navigationId,
          }),
        });

        const data = await response.json();
        setNavigationStatus(data.status);
        setCurrentInstruction(data.instruction);

        if (data.status === 'Navigation completed') {
          clearInterval(updateInterval);
          setNavigationId(null);
        }
      } catch (error) {
        console.error('Error updating location:', error);
      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(updateInterval);
  }, [navigationId, location]);

  const startNavigation = async () => {
    if (!location || !destination) return;

    try {
      console.log('Sending navigation request:', {
        origin: [location.coords.latitude, location.coords.longitude],
        destination: destination,
        mode: "walking"
      });
      
      const response = await fetch(`${API_BASE_URL}/directions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: [location.coords.latitude, location.coords.longitude],
          destination: destination,
          mode: "walking"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Navigation error:', errorData);
        return;
      }

      const data = await response.json();
      setNavigationId(data.navigation_id);
      setCurrentInstruction(data.next_instruction);
      setNavigationStatus('Started');
    } catch (error) {
      console.error('Error starting navigation:', error);
    }
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="w-full bg-blue-500 p-6 items-center shadow-lg">
        <Text className="text-2xl font-bold text-white mt-8">Navigation App</Text>
      </View>

      {/* Main Content */}
      <View className="flex-1 p-6">
        <View className="bg-white rounded-xl p-6 w-full shadow-md mb-4">
          <TextInput
            className="border border-gray-300 rounded-lg p-2 mb-4"
            placeholder="Enter destination"
            value={destination}
            onChangeText={setDestination}
          />
          
          <TouchableOpacity 
            className="bg-blue-500 p-4 rounded-lg items-center"
            onPress={startNavigation}
            disabled={!!(!location || !destination || navigationId)}
          >
            <Text className="text-white font-semibold">
              {navigationId ? 'Navigation in Progress' : 'Start Navigation'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Navigation Instructions */}
        {currentInstruction && (
          <View className="bg-white rounded-xl p-6 w-full shadow-md mb-4">
            <Text className="text-lg font-semibold mb-2">Current Instruction:</Text>
            <Text className="text-gray-600">{currentInstruction}</Text>
            {navigationStatus && (
              <Text className="text-blue-500 mt-2">Status: {navigationStatus}</Text>
            )}
          </View>
        )}

        {/* Location Display */}
        {location && (
          <View className="bg-white rounded-xl p-4 shadow-md">
            <Text className="text-gray-600 mb-2">Current Location:</Text>
            <Text className="text-gray-600">Latitude: {location.coords.latitude}</Text>
            <Text className="text-gray-600">Longitude: {location.coords.longitude}</Text>
          </View>
        )}
        
        {locationError && (
          <View className="error p-4">
            <Text className="text-red-500">Location Error: {locationError}</Text>
          </View>
        )}
      </View>

      <StatusBar style="light" />
    </View>
  );
}