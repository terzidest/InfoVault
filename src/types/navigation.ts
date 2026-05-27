import type { StackScreenProps } from '@react-navigation/stack';

export type RootStackParamList = {
  Authentication: undefined;
  Home: undefined;
  CredentialsList: undefined;
  AddCredential: undefined;
  ViewCredential: { id: string };
  PersonalInfoList: undefined;
  AddPersonalInfo: undefined;
  ViewPersonalInfo: { id: string };
  NotesList: undefined;
  AddNote: undefined;
  ViewNote: { id: string };
  Settings: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = StackScreenProps<RootStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
