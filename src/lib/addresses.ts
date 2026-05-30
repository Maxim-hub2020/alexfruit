import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { addressSchema } from "@/lib/validators";

function serializeAddress(address: Awaited<ReturnType<typeof prisma.address.findFirst>>) {
  if (!address) {
    return null;
  }

  return {
    id: address.id,
    userId: address.userId,
    title: address.title,
    city: address.city,
    street: address.street,
    house: address.house,
    apartment: address.apartment,
    entrance: address.entrance,
    floor: address.floor,
    comment: address.comment,
    latitude: address.latitude?.toString() ?? null,
    longitude: address.longitude?.toString() ?? null,
    isDefault: address.isDefault,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export async function getUserAddresses(userId: string) {
  const addresses = await prisma.address.findMany({
    where: { userId, isDeleted: false },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return addresses.map((address) => serializeAddress(address)!);
}

export async function saveAddressForUser(
  userId: string,
  input: unknown,
  addressId?: string,
) {
  const data = addressSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const payload = {
      userId,
      title: data.title,
      city: data.city,
      street: data.street,
      house: data.house,
      apartment: data.apartment || null,
      entrance: data.entrance || null,
      floor: data.floor || null,
      comment: data.comment || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      isDefault: data.isDefault,
    };

    let address;

    if (addressId) {
      const existing = await tx.address.findFirst({
        where: { id: addressId, userId, isDeleted: false },
      });

      if (!existing) {
        throw new ApiError("Адрес не найден", 404);
      }

      address = await tx.address.update({
        where: { id: addressId },
        data: payload,
      });
    } else {
      address = await tx.address.create({
        data: payload,
      });
    }

    if (data.isDefault) {
      await tx.address.updateMany({
        where: {
          userId,
          isDeleted: false,
          id: { not: address.id },
        },
        data: { isDefault: false },
      });

      await tx.customerProfile.upsert({
        where: { userId },
        update: { defaultAddressId: address.id },
        create: {
          userId,
          defaultAddressId: address.id,
        },
      });
    }

    return address;
  });
}

export async function removeAddressForUser(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId, isDeleted: false },
  });

  if (!address) {
    throw new ApiError("Адрес не найден", 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.address.update({
      where: { id: addressId },
      data: {
        isDeleted: true,
        isDefault: false,
      },
    });

    const nextDefaultAddress = address.isDefault
      ? await tx.address.findFirst({
          where: {
            userId,
            isDeleted: false,
            id: { not: addressId },
          },
          orderBy: { createdAt: "asc" },
        })
      : null;

    if (nextDefaultAddress) {
      await tx.address.update({
        where: { id: nextDefaultAddress.id },
        data: { isDefault: true },
      });
    }

    await tx.customerProfile.updateMany({
      where: {
        userId,
        defaultAddressId: addressId,
      },
      data: {
        defaultAddressId: nextDefaultAddress?.id ?? null,
      },
    });
  });
}

export async function setDefaultAddress(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId, isDeleted: false },
  });

  if (!address) {
    throw new ApiError("Адрес не найден", 404);
  }

  await prisma.$transaction([
    prisma.address.updateMany({
      where: { userId, isDeleted: false },
      data: { isDefault: false },
    }),
    prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    }),
    prisma.customerProfile.upsert({
      where: { userId },
      update: { defaultAddressId: addressId },
      create: { userId, defaultAddressId: addressId },
    }),
  ]);
}
