declare module "web-push" {
  type PushSubscription = {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };

  type RequestOptions = {
    TTL?: number;
    timeout?: number;
  };

  const webPush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: PushSubscription,
      payload?: string | Buffer,
      options?: RequestOptions,
    ): Promise<unknown>;
  };

  export default webPush;
}
