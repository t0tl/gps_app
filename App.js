import { StatusBar } from 'expo-status-bar';
import { Text, View, TouchableOpacity } from 'react-native';
import "./global.css"

export default function App() {
  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="w-full bg-blue-500 p-6 items-center shadow-lg">
        <Text className="text-2xl font-bold text-white mt-8">Welcome!</Text>
      </View>

      {/* Main Content */}
      <View className="flex-1 items-center justify-center p-6">
        <View className="bg-white rounded-xl p-6 w-full shadow-md">
          <Text className="text-gray-600 mb-6">
            This is your new React Native app powered by Expo and styled with Tailwind CSS.
          </Text>
          
          <TouchableOpacity 
            className="bg-blue-500 p-4 rounded-lg items-center"
            onPress={() => alert('Button pressed!')}
          >
            <Text className="text-white font-semibold">Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>

      <StatusBar style="light" />
    </View>
  );
}