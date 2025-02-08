import * as Location from 'expo-location';

export default class LocationTracker {
  constructor() {
    this.watchId = null;
  }

  async startTracking() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      // Get the initial position
      const position = await Location.getCurrentPositionAsync({});
      return position;
    } catch (error) {
      throw new Error('Error getting location: ' + error.message);
    }
  }

  stopTracking() {
    if (this.watchId) {
      Location.removeWatchPositionAsync(this.watchId);
      this.watchId = null;
    }
  }
} 