import "react-native-reanimated"; // Mantido para consistência com seu modelo
import { ImageBackground } from "react-native";
import "@/global.css"; // Mantido para consistência com seu modelo
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { useNavigation } from "@react-navigation/native";
import { appContext } from "@/src/context";

const image = require("@/assets/joinha.jpg");

export default function VerificacaoSucessoBiometriaScreen() {
  const navigation = useNavigation();
  const { serverPhotoPath, setServerPhotoPath } = appContext();

  return (
    <GluestackUIProvider mode='light'>
      <Box className='flex-1'>
        {/* ImageBackground sobrepondo a câmera com um z-index maior */}
        <ImageBackground
          style={{
            position: "absolute",
            left: 0, // Margem esquerda
            right: 0, // Margem direita
            top: 0, // Margem superior maior
            bottom: 0, // Margem inferior menor
          }}
          source={image}
          resizeMode='cover'
          className='absolute inset-0 z-10' // z-10 para sobrepor
        />
        <Box className='flex  absolute bottom-0 h-1/4 w-full p-4 items-center z-20'>
          <Text className='text-4xl text-red-300 font-bold  text-center mb-4 bg-white '>
            Tudo Certo?
          </Text>
          <HStack className='gap-10'>
            <Button
              className='w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center'
              onPress={() => {
                navigation.navigate("Login");
              }}
            >
              <ButtonText className='text-lg text-blue-950 font-bold'>
                sim
              </ButtonText>
            </Button>

            <Button
              className='w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center'
              onPress={() => {
                navigation.navigate("AvisoBiometria");
              }}
            >
              <ButtonText className='text-lg text-blue-950 font-bold'>
                não
              </ButtonText>
            </Button>
          </HStack>
        </Box>
      </Box>
    </GluestackUIProvider>
  );
}
