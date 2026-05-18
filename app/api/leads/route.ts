// app/api/leads/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { allocateLead } from "@/lib/allocate";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, city, serviceId, description } = body;

    if (!name || !phone || !city || !serviceId || !description) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    // Validate service exists
    const service = await prisma.service.findUnique({
      where: { id: Number(serviceId) },
    });
    if (!service) {
      return NextResponse.json({ error: "Invalid service." }, { status: 400 });
    }

    // Duplicate check (also enforced at DB level via @@unique)
    const existing = await prisma.lead.findUnique({
      where: { phone_serviceId: { phone, serviceId: Number(serviceId) } },
    });
    if (existing) {
      return NextResponse.json(
        {
          error:
            "This phone number has already submitted a lead for this service.",
        },
        { status: 409 }
      );
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        name,
        phone,
        city,
        description,
        serviceId: Number(serviceId),
      },
    });

    // Allocate providers (async — errors are caught and do not fail lead creation)
    try {
      await allocateLead(lead.id, service.name);
    } catch (allocErr) {
      console.error("Allocation error:", allocErr);
      // Lead is created; return partial success with warning
      return NextResponse.json(
        { lead, warning: "Lead created but allocation failed. Check logs." },
        { status: 201 }
      );
    }

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err: unknown) {
    // Unique constraint violation from DB
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        {
          error:
            "This phone number has already submitted a lead for this service.",
        },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET() {
  const leads = await prisma.lead.findMany({
    include: {
      service: true,
      assignments: { include: { provider: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(leads);
}
