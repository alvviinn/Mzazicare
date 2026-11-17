import { registerRootComponent } from 'expo';

import App from './App';
// Registers the background location task at start-up (Android may start the app with no screen to run it).
import './src/location/backgroundTask';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
