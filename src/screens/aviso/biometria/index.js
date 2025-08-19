import "react-native-reanimated";
import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { ImageBackground } from "react-native";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { useNavigation } from "@react-navigation/native";
import RNFetchBlob from "rn-fetch-blob";
import useCurrentLocation from "@/src/hooks/location";
import { appContext } from "@/src/context";

const image = require("@/assets/avatarproximo.jpg");

export default function AvisoBiometriaScreen() {
  const navigation = useNavigation();
  const { location, errorMsg, loading } = useCurrentLocation();
  const { matricula } = appContext();

  /**
   * Envia dados de usuário para o endpoint usando RNFetchBlob (POST JSON)
   *
   * @param {string} id - Identificador do usuário
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<object>} Resposta em JSON do servidor
   */
  async function enviarUsuario(id, lat, lng) {
    const url =
      "https://comlurbdev.rio.rj.gov.br/extranet/Fotos/fotoRecoginizer/usuario.php";

    try {
      const response = await RNFetchBlob.fetch(
        "POST",
        url,
        {
          "Content-Type": "application/json",
        },
        JSON.stringify({
          id,
          lat,
          lng,
        })
      );

      // Converte resposta para objeto
      const jsonData = JSON.parse(response.data);
      return jsonData;
    } catch (error) {
      console.error("Erro ao enviar dados do usuário:", error);
      throw error;
    }
  }

  const handleConfirmar = async () => {
    try {
      const { latitude, longitude } = location;
      await enviarUsuario(matricula, latitude, longitude);
      navigation.navigate("VerificacaoBiometria");
    } catch (error) {
      console.error("Erro ao enviar usuário:", error);
    }
  };

  /**
   * Componente interno para renderizar a tela com imagem de fundo,
   * texto centralizado e opcional botão
   */
  const RenderContent = ({ text, showButton = false, onButtonPress }) => (
    <GluestackUIProvider mode='light'>
      <Box className='flex-1'>
        <ImageBackground
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          source={image}
          resizeMode='cover'
          className='absolute inset-0 z-10'
        />
        <Box className='flex absolute bottom-16 w-full items-center z-20'>
          <Text className='text-xl text-red-900 font-extrabold text-center mb-4 bg-white'>
            {text}
          </Text>
          {showButton && (
            <Button
              className='w-40 h-40 rounded-full bg-blue-100'
              onPress={onButtonPress}
            >
              <ButtonText className='text-2xl text-blue-950'>
                confirmar
              </ButtonText>
            </Button>
          )}
        </Box>
      </Box>
    </GluestackUIProvider>
  );

  if (errorMsg) {
    return (
      <RenderContent
        text={`Erro apresentado: ${errorMsg}`}
        showButton={true}
        onButtonPress={() => navigation.navigate("Login")}
      />
    );
  }

  if (loading) {
    return <RenderContent text='Verificando posição atual.' />;
  }

  return (
    <RenderContent
      text='Aproxime-se do dispositivo de verificação facial e confirme no botão.'
      showButton={true}
      onButtonPress={handleConfirmar}
    />
  );
}
