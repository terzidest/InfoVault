import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  SetupMasterPassword: undefined;
  Authentication: undefined;
  Home: undefined;
  CredentialsList: undefined;
  AddCredential: { id?: string } | undefined;
  ViewCredential: { id: string };
  PersonalInfoList: undefined;
  AddPersonalInfo: { id?: string } | undefined;
  ViewPersonalInfo: { id: string };
  NotesList: undefined;
  AddNote: { id?: string } | undefined;
  ViewNote: { id: string };
  Settings: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

declare global {
  namespace ReactNavigation {
    // React Navigation's documented global-augmentation pattern requires this
    // member-less interface; a type alias cannot merge into the namespace.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
