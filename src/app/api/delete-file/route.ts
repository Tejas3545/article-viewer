import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  console.error(
    "CRITICAL: Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not properly set. Deletion API will not work."
  );
}

export async function POST(request: Request) {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return NextResponse.json(
      {
        message: "Cloudinary server configuration is incomplete.",
        success: false,
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { publicId, resourceType = "raw" } = body;

    if (!publicId) {
      return NextResponse.json(
        { message: "Missing publicId for deletion.", success: false },
        { status: 400 }
      );
    }

    const validResourceTypes = ["image", "video", "raw"];
    if (!validResourceTypes.includes(resourceType)) {
      return NextResponse.json(
        {
          message: `Invalid resourceType: ${resourceType}. Must be one of ${validResourceTypes.join(
            ", "
          )}`,
          success: false,
        },
        { status: 400 }
      );
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    if (result.result === "ok") {
      return NextResponse.json(
        {
          message: "Asset successfully deleted from Cloudinary.",
          success: true,
        },
        { status: 200 }
      );
    } else if (result.result === "not found") {
      console.warn(`Cloudinary asset not found for deletion: ${publicId}`);
      return NextResponse.json(
        {
          message:
            "Asset not found on Cloudinary. It might have been already deleted.",
          success: true,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          message: "Failed to delete asset from Cloudinary.",
          success: false,
          details: result,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in Cloudinary deletion API route:", error);
    return NextResponse.json(
      {
        message: "Internal server error during Cloudinary deletion.",
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
