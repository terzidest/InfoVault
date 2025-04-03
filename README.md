# InfoVault

InfoVault is a secure personal information management application built with React Native and Expo. The application addresses the growing need for individuals to store sensitive personal information securely in a digital format.

## Features

### Core Features

- **Secure Storage**: Store your sensitive information with encryption
- **Biometric Authentication**: Access your data using fingerprint/face recognition or PIN
- **Auto-Logout**: Automatic session termination after inactivity
- **Credentials Manager**: Store website credentials and passwords
- **Personal Information Vault**: Store identification numbers and personal records
- **Secure Notes**: Create and store encrypted notes
- **Categorization**: Organize your information by categories

### Security Measures

- Local device encryption with Expo Secure Store
- Biometric authentication integration
- Masking of sensitive data
- Auto-timeout for inactive sessions
- No cloud storage of sensitive data in the MVP (planned for future releases)

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/info-vault.git
cd info-vault
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Start the Expo development server:

```bash
npm start
# or
yarn start
```

4. Run on iOS/Android:
   - Scan the QR code with the Expo Go app
   - Press 'i' for iOS simulator (requires macOS and Xcode)
   - Press 'a' for Android emulator (requires Android Studio)

## Project Structure

```
info_vault/
├── src/
│   ├── assets/                   # Static assets (images, animations)
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Base UI components
│   │   ├── layouts/              # Layout components
│   │   └── features/             # Feature-specific components
│   ├── screens/                  # Application screens
│   ├── store/                    # Zustand state management
│   ├── services/                 # Core services (auth, storage)
│   ├── utils/                    # Utility functions
│   └── hooks/                    # Custom React hooks
├── App.jsx                       # Application entry point
├── babel.config.js               # Babel configuration
├── app.json                      # Expo configuration
└── package.json                  # Dependencies
```

## Technology Stack

- **React Native**: Core framework for cross-platform mobile development
- **Expo**: Development platform and toolchain
- **NativeWind**: Utility-first CSS framework based on Tailwind
- **Zustand**: Lightweight state management
- **React Navigation**: Navigation library
- **Expo Secure Store**: Encrypted local storage
- **Expo Local Authentication**: Biometric authentication
- **Lottie**: Animations library

## Security Best Practices

- No unencrypted sensitive data in application state
- Minimal clipboard usage for sensitive data
- Automatic timeout-based logout
- Secure text entry for sensitive inputs
- Data validation for all inputs

## Roadmap

### Phase 1: MVP (Current)

- Core authentication
- Basic information categories
- Local secure storage
- Essential UI components

### Phase 2: Enhanced Security

- Password strength analysis
- Advanced encryption options
- Security audit logging
- Auto-logout configuration

### Phase 3: Premium Features

- Cloud backup (Firebase)
- Cross-device synchronization
- Custom categories and fields
- Enhanced search capabilities

### Phase 4: Monetization

- Freemium model implementation
- Subscription management
- In-app purchases for premium features

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Expo team for the excellent React Native toolchain
- React Navigation for the navigation library
- Zustand for the lightweight state management
- Icons from Ionicons
