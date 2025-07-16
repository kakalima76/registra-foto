import "react-native-reanimated";
import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { Alert, StyleSheet, ImageBackground } from "react-native";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
} from "react-native-vision-camera";
import { useFaceDetector } from "react-native-vision-camera-face-detector";
import { Worklets } from "react-native-worklets-core";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Spinner } from "@/components/ui/spinner";
import colors from "tailwindcss/colors";
import { appContext } from "@/src/context";
import { useNavigation } from "@react-navigation/native";
import RNFetchBlob from "rn-fetch-blob";
import ImageResizer from "react-native-image-resizer";
const GENDER_API_URL =
  "https://comlurbdev.rio.rj.gov.br/extranet/Fotos/fotoRecoginizer/gender.php";

const image = require("../../../assets/fundo3.png"); // Caminho relativo para sua imagem

/**
 * Helper function to determine the MIME type based on URI extension.
 * @param {string} uri - The URI of the image.
 * @returns {string} The determined MIME type.
 */
const getMimeType = (uri) => {
  const extension = uri.split(".").pop().toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  return "application/octet-stream"; // Generic fallback
};

/**
 * Verifica se um rosto detectado está olhando diretamente para a frente e com ambos os olhos abertos.
 *
 * Esta função avalia os ângulos de rotação da cabeça (pitch, roll, yaw) e as
 * probabilidades de ambos os olhos estarem abertos. Ela retorna `true` se todos os ângulos estiverem
 * dentro dos limites predefinidos e ambos os olhos forem considerados abertos com base em suas
 * probabilidades.
 *
 * @param {object} rosto - Um objeto contendo os dados de detecção do rosto.
 * @param {number} rosto.pitchAngle - O ângulo de inclinação da cabeça em graus (para cima/para baixo).
 * @param {number} rosto.rollAngle - O ângulo de rotação lateral da cabeça em graus (inclinação para o ombro).
 * @param {number} rosto.yawAngle - O ângulo de rotação da cabeça em graus (para a esquerda/direita).
 * @param {number} rosto.leftEyeOpenProbability - A probabilidade (0-1) de o olho esquerdo estar aberto.
 * @param {number} rosto.rightEyeOpenProbability - A probabilidade (0-1) de o olho direito estar aberto.
 * @returns {boolean} - Retorna `true` se o rosto estiver olhando para a frente com os olhos abertos, `false` caso contrário.
 */
function estaOlhandoParaFrente(rosto) {
  // Limites aceitáveis para os ângulos de rotação da cabeça (em graus)
  const LIMITE_PITCH = 3; // Inclinação para cima/baixo
  const LIMITE_ROLL = 10; // Inclinação lateral (ombro)
  const LIMITE_YAW = 10; // Rotação esquerda/direita

  // Probabilidade mínima para considerar os olhos abertos
  const PROBABILIDADE_OLHO_ABERTO = 0.95;

  // Extrai os ângulos do objeto rosto
  const {
    pitchAngle,
    rollAngle,
    yawAngle,
    leftEyeOpenProbability,
    rightEyeOpenProbability,
  } = rosto;

  // Verifica se os ângulos estão dentro dos limites aceitáveis
  const angulosValidos =
    Math.abs(pitchAngle) <= LIMITE_PITCH &&
    Math.abs(rollAngle) <= LIMITE_ROLL &&
    Math.abs(yawAngle) <= LIMITE_YAW;

  // Verifica se ambos os olhos estão abertos (ou pelo menos não muito fechados)
  const olhosAbertos =
    leftEyeOpenProbability >= PROBABILIDADE_OLHO_ABERTO &&
    rightEyeOpenProbability >= PROBABILIDADE_OLHO_ABERTO;

  return angulosValidos && olhosAbertos;
}

export default function CameraScreen() {
  const faceDetectionOptions = useRef({
    landmarkMode: "all",
    classificationMode: "all",
  }).current;

  const device = useCameraDevice("front");
  const { detectFaces } = useFaceDetector(faceDetectionOptions);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [isGazing, setIsGazing] = useState(false); //verifica se o usuário está olhando para a câmera
  const [photo, setPhoto] = useState(true);
  const [spinner, setSpinner] = useState(false);
  const { setServerPhotoPath, matricula, setMatriculaFormatada } = appContext();
  const camera = useRef(null);
  const navigation = useNavigation();

  /**
   * Consome o endpoint PHP de análise de idade e gênero.
   * Envia uma imagem e recebe a idade e o gênero estimados.
   * @param {string} uri - URI da imagem no dispositivo.
   * @returns {Promise<object|null>} Uma Promise que resolve com o resultado da análise em caso de sucesso, ou null em caso de erro.
   */
  const analyzeGenderAgeRN = async (uri) => {
    if (!uri) {
      Alert.alert("Erro", "Por favor, selecione uma imagem para análise.");
      return null;
    }

    try {
      const response = await RNFetchBlob.fetch(
        "POST",
        GENDER_API_URL,
        {
          "Content-Type": "multipart/form-data",
        },
        [
          {
            name: "imagem",
            filename: "image.jpg",
            type: getMimeType(uri),
            data: RNFetchBlob.wrap(uri),
          },
        ]
      );

      const result = await response.json();
      console.log("result", result);

      if (response.respInfo.status === 200) {
        return result;
      } else {
        Alert.alert(
          "Erro na API",
          result.message || "Ocorreu um erro na análise de idade e gênero."
        );
        console.error("Erro na análise:", result);
        return null;
      }
    } catch (error) {
      navigation.navigate("ErrorPhoto");
    }
  };

  /**
   * Redimensiona e realiza o upload de uma imagem para o servidor da Comlurb
   * @function uploadImageToComlurb
   * @param {string} imagePath - Caminho local da imagem no dispositivo (pode incluir prefixo file://)
   * @param {string} imageName - Nome que será atribuído à imagem no servidor
   * @returns {Promise<string>} Promise que resolve com a resposta textual do servidor
   * @throws {Error} Lança erro caso o redimensionamento ou upload falhem
   *
   * @example
   * // Exemplo de uso:
   * uploadImageToComlurb(
   *   '/data/user/0/com.app/files/image.jpg',
   *   'foto_identificacao.jpg'
   * )
   * .then(response => console.log(response))
   * .catch(error => console.error(error));
   */
  const uploadImageToComlurb = async (imagePath, imageName) => {
    const url =
      "https://comlurbdev.rio.rj.gov.br/extranet/Fotos/fotoRecoginizer/upload.php";

    try {
      // 1. Redimensiona a imagem antes do upload
      const { uri: resizedUri } = await ImageResizer.createResizedImage(
        imagePath.replace("file://", ""), // Remove prefixo se existir
        224, // Largura máxima
        224, // Altura máxima
        "JPEG", // Formato
        80, // Qualidade
        0, // Rotação
        undefined // Caminho padrão
      );

      console.log("imagem redimensionada");

      // 2. Faz upload da versão redimensionada
      const response = await RNFetchBlob.fetch(
        "POST",
        url,
        {
          "Content-Type": "multipart/form-data",
        },
        [
          {
            name: "imagem",
            filename: imageName,
            data: RNFetchBlob.wrap(resizedUri),
          },
          { name: "name", data: imageName },
        ]
      );

      console.log("imagem, uploudiada");

      return response.text();
    } catch (error) {
      console.error("Erro no processamento/upload:", error);

      // Alertas específicos
      if (error.message.includes("createResizedImage")) {
        Alert.alert("Erro ao processar", "Falha ao redimensionar a imagem");
      } else {
        Alert.alert("Erro no upload", "Falha ao enviar para o servidor");
      }

      navigation.navigate("ErrorPhoto");
    }
  };

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === "granted");
      if (status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Por favor, permita o acesso à câmera nas configurações do dispositivo"
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (isGazing) {
      const _takePhoto = async function () {
        try {
          const photo = await camera.current.takePhoto();
          setPhoto(false);
          const { path } = photo;
          setServerPhotoPath(path);
          setIsGazing(false);
          setSpinner(true);

          // Remove o prefixo 'file://' se existir
          const cleanedPath = path.replace(/^file:\/\//, "");

          console.log(isGazing, cleanedPath);
          const _gender = await analyzeGenderAgeRN(cleanedPath);
          console.log(_gender);
          const { analise_facial } = _gender;
          console.log(analise_facial);
          const { genero_dominante, idade_aproximada } = analise_facial;
          console.log(genero_dominante, idade_aproximada);

          let _genero;

          if (genero_dominante === "Man") {
            _genero = "00";
          } else {
            _genero = "01";
          }

          let _primerioCaracter = matricula.toString().substring(0, 1);

          let _matricula;

          //Uso estes testes para saber que tipo de prefixo por em cada foto, para busca-las no servidor adequadamente!
          if (matricula.toString().length <= 6) {
            _matricula = "014" + matricula.toString().padStart(6, "0");
          }

          if (_primerioCaracter === "8" && matricula.toString().length >= 6) {
            _matricula = "0" + matricula.toString().padStart(6, "0");
          }

          if (matricula.length > 6 && _primerioCaracter != "8") {
            _matricula = matricula.toString().padStart(6, "0"); // Alguns casos não estão nos padrões das matriculas que usamos, sendo assim vai entrar dessa maneira na pasta de imagem, apenas a matricula
          }

          const _matriculaFormatada =
            _matricula +
            _genero +
            String(idade_aproximada).padStart(2, "0").concat(".jpg");

          setMatriculaFormatada(_matriculaFormatada);

          console.log("matriculaFormatada", _matriculaFormatada);

          await uploadImageToComlurb(cleanedPath, _matriculaFormatada);
          setSpinner(false);
          navigation.navigate("Sucesso");
        } catch (error) {
          console.logh(error);
          setIsGazing(false); // Resetar mesmo em caso de erro
          setPhoto(false);
        }
      };

      _takePhoto();
    }
  }, [isGazing]);

  const handleDetectedFaces = useCallback(
    Worklets.createRunOnJS((facesJson) => {
      try {
        const faces = JSON.parse(facesJson);
        if (Array.isArray(faces) && faces.length > 0) {
          const bool = estaOlhandoParaFrente(faces[0]);
          setIsGazing(bool);
        }

        setDetectedFaces(faces);
      } catch (error) {
        console.error("Erro ao parsear JSON dos rostos:", error);
      }
    }),
    []
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      const faces = detectFaces(frame);
      const facesJson = JSON.stringify(faces);
      handleDetectedFaces(facesJson);
    },
    [handleDetectedFaces]
  );

  if (!device) {
    return (
      <GluestackUIProvider mode='light'>
        <Box className='flex-1 bg-black justify-center items-center'>
          <Text className='text-white text-lg'>
            Nenhuma câmera frontal encontrada
          </Text>
        </Box>
      </GluestackUIProvider>
    );
  }

  if (!hasPermission) {
    return (
      <GluestackUIProvider mode='light'>
        <Box className='flex-1 bg-black justify-center items-center'>
          <Text className='text-white text-lg text-center p-4'>
            Aguardando permissão da câmera... Por favor, conceda a permissão nas
            configurações do aplicativo.
          </Text>
        </Box>
      </GluestackUIProvider>
    );
  }

  return (
    <GluestackUIProvider mode='light'>
      {!spinner && (
        <Box className='flex-1'>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={photo}
            frameProcessor={frameProcessor}
            frameProcessorFps={5}
            orientation='portrait'
            photo={photo}
            ref={camera}
            zoom={device.maxZoom}
          />

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
            r
            className='absolute inset-0 z-10' // z-10 para sobrepor
          />
          <Box className='absolute bottom-20 w-full bg-blue-500 p-4 items-center z-20'>
            {isGazing && (
              <Text className='text-white text-3xl'>Olhando para a camera</Text>
            )}
            {!isGazing && (
              <Text className='text-white text-3xl'>Olhe para a câmera</Text>
            )}
            {/* <Button
            className='w-72 h-16 rounded-full bg-blue-100 self-center' // self-center para centralizar o botão dentro do VStack
            onPress={async () => await handleTakePhoto()}
          >
            <ButtonText className='text-3xl text-blue-950'>acessar</ButtonText>
          </Button> */}
          </Box>
        </Box>
      )}

      {spinner && (
        <Box className='flex-1 bg-black justify-center items-center'>
          <Spinner size='large' className='text-green-50' />
        </Box>
      )}
    </GluestackUIProvider>
  );
}
