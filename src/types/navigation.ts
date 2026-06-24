import type { StackScreenProps } from '@react-navigation/stack';

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

export type ScreenProps<T extends keyof RootStackParamList> = StackScreenProps<RootStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
