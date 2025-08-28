import React, { useState, useCallback, useEffect } from 'react'
import { GiftedChat, IMessage } from 'react-native-gifted-chat'
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigator/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen() {
  const [messages, setMessages] = useState<IMessage[]>([]);

  useEffect(() => {
    setMessages([
      {
        _id: 1,
        text: 'こんにちは！',
        createdAt: new Date(),
        user: {
          _id: 2,
          name: 'React Native',
          avatar: 'https://placeimg.com/140/140/any',
        },
      },
    ])
  }, [])

  const onSend = useCallback((messages: IMessage[] = []) => { // ここに型定義を追加しました
    setMessages(previousMessages =>
      GiftedChat.append(previousMessages, messages),
    )
  }, [])

  return (
    <GiftedChat
      messages={messages}
      onSend={messages => onSend(messages)}
      user={{
        _id: 1,
      }}
    />
  )
}