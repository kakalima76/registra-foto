import "react-native-reanimated"; // Mantido para consistência com seu modelo
import "@/global.css"; // Mantido para consistência com seu modelo
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useNavigation } from "@react-navigation/native";
import { Button, ButtonText } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { appContext } from "@/src/context";
import { useEffect } from "react";

export default function SucessoScreen() {
  const navigation = useNavigation();
  const { serverPhotoPath, setServerPhotoPath } = appContext();

  useEffect(() => {
    console;
    console.log("serverPhotoPath", serverPhotoPath);
  }, []);

  const handleOK = () => {
    setServerPhotoPath(null);
    navigation.navigate("Login");
  };

  return (
    <GluestackUIProvider mode='light'>
      {/* VStack para centralizar o conteúdo verticalmente e horizontalmente */}
      <VStack className='flex-1 justify-center items-center p-5'>
        <Text
          // Usando classes NativeWind para estilizar o texto
          // text-green-500 para a cor verde (você pode ajustar a tonalidade)
          // text-2xl para o tamanho da fonte (ajuste conforme preferência)
          // font-bold para negrito
          // mb-2 para uma pequena margem inferior entre as duas linhas
          className='text-green-500 text-2xl font-bold mb-2 text-center'
        >
          SUCESSO
        </Text>
        <Text
          // Estilizando a segunda linha
          className='text-green-500 text-xl text-center'
        >
          Foto salva com sucesso.
        </Text>

        <Image
          // Classes NativeWind para ocupar 100% da largura e altura do seu contêiner pai (o Box)
          className='w-60 h-96'
          source={{
            uri: `file://${serverPhotoPath}`, // Mantido o prefixo 'file://' conforme discutido
          }}
          alt='Imagem capturada' // Melhor descrição para alt
          resizeMode='contain' // Ou 'cover', dependendo de como você quer que a imagem se ajuste
        />

        <Button
          className='h-24 w-24 bg-green-800 rounded-full mt-6'
          onPress={handleOK}
        >
          <ButtonText className='text-2xl'>OK</ButtonText>
        </Button>
      </VStack>
    </GluestackUIProvider>
  );
}
