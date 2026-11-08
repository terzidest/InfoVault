import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TemplateId } from './models';

export type RootStackParamList = {
  SetupMasterPassword: undefined;
  Authentication: undefined;
  Home: undefined;
  Record: { id: string };
  AddEditRecord: { id?: string; template?: TemplateId } | undefined;
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
