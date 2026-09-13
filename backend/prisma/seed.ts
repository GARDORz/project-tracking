import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { generateJobNo } from '../src/services/jobNo.js'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('Admin2559', 10)

  const admin = await prisma.user.upsert({
    where: { userID: 'Admin' },
    update: {},
    create: {
      userID: 'Admin',
      name: 'Admin',
      passwordHash,
      role: 'ADMIN',
    },
  })

  let parentCustomer = await prisma.customer.findFirst({
    where: { name: 'บริษัท ตัวอย่าง กรุ๊ป จำกัด' },
  })
  if (!parentCustomer) {
    parentCustomer = await prisma.customer.create({
      data: {
        name: 'บริษัท ตัวอย่าง กรุ๊ป จำกัด',
        comment: 'บริษัทแม่ตัวอย่าง',
      },
    })
  }

  let childCustomer = await prisma.customer.findFirst({
    where: { name: 'บริษัท ตัวอย่าง สาขา 1 จำกัด' },
  })
  if (!childCustomer) {
    childCustomer = await prisma.customer.create({
      data: {
        name: 'บริษัท ตัวอย่าง สาขา 1 จำกัด',
        parentName: parentCustomer.name,
        comment: 'ในเครือของบริษัท ตัวอย่าง กรุ๊ป จำกัด',
      },
    })
  }

  let otherCustomer = await prisma.customer.findFirst({
    where: { name: 'ห้างหุ้นส่วนจำกัด ทดสอบ อีกที' },
  })
  if (!otherCustomer) {
    otherCustomer = await prisma.customer.create({
      data: {
        name: 'ห้างหุ้นส่วนจำกัด ทดสอบ อีกที',
        comment: 'ลูกค้าอิสระ ไม่มีบริษัทแม่',
      },
    })
  }

  const sampleJobs = [
    {
      title: 'เครื่องพิมพ์ใช้งานไม่ได้',
      description: 'เครื่องพิมพ์รุ่น XYZ แจ้งเตือน error E-04 ตลอดเวลา',
      type: 'WARRANTY' as const,
      status: 'NEW' as const,
      remark: 'ลูกค้าต้องการให้เข้าซ่อมด่วน',
      customerId: childCustomer.id,
    },
    {
      title: 'ตรวจเช็คระบบตามรอบบำรุงรักษา',
      description: 'บำรุงรักษาตามสัญญา MA ประจำไตรมาส',
      type: 'MA_SERVICE' as const,
      status: 'IN_PROGRESS' as const,
      remark: 'นัดหมายลูกค้าไว้แล้ว',
      customerId: childCustomer.id,
    },
    {
      title: 'ลูกค้าแจ้งเสียงเครื่องดังผิดปกติ',
      description: 'ตรวจสอบเบื้องต้นคาดว่าเป็นพัดลมระบายความร้อน',
      type: 'PERCALL' as const,
      status: 'COMPLETED' as const,
      remark: 'เปลี่ยนพัดลมเรียบร้อย ปิดงานแล้ว',
      customerId: childCustomer.id,
    },
    {
      title: 'รออะไหล่เปลี่ยนเมนบอร์ด',
      description: 'สั่งอะไหล่จากศูนย์ คาดว่าใช้เวลา 1 สัปดาห์',
      type: 'WARRANTY' as const,
      status: 'ON_HOLD' as const,
      remark: 'รออะไหล่จากต่างประเทศ',
      customerId: otherCustomer.id,
    },
    {
      title: 'ลูกค้ายกเลิกนัดหมาย',
      description: 'ลูกค้าแก้ปัญหาเองได้แล้ว ไม่ต้องเข้าซ่อม',
      type: 'PERCALL' as const,
      status: 'CANCELLED' as const,
      remark: 'ลูกค้าโทรมายกเลิกเอง',
      customerId: otherCustomer.id,
    },
    {
      title: 'ติดตั้งซอฟต์แวร์เพิ่มเติมตามคำขอ',
      description: 'ลูกค้าขอให้ติดตั้งโปรแกรมเสริมนอกเหนือสัญญา',
      type: 'OTHER' as const,
      status: 'NEW' as const,
      remark: 'ต้องเสนอราคาก่อนดำเนินการ',
      customerId: parentCustomer.id,
    },
  ]

  for (const sample of sampleJobs) {
    const existingJob = await prisma.serviceJob.findFirst({
      where: { title: sample.title },
    })
    if (!existingJob) {
      const jobNo = await generateJobNo(prisma)
      await prisma.serviceJob.create({
        data: {
          jobNo,
          reporterId: admin.id,
          assignees: { create: { userId: admin.id } },
          ...sample,
        },
      })
    }
  }

  // A small "team" plus a spread of jobs across statuses/types/time-tracking
  // history, so pages like ภาพรวม (Overview) and รายงาน (Reports) have enough
  // realistic variety to actually look meaningful in dev, instead of just the
  // handful of jobs above (all reported by and assigned to Admin).
  const teamPasswordHash = await bcrypt.hash('Password123', 10)
  const [engineer1, engineer2, superEngineer1] = await Promise.all([
    prisma.user.upsert({
      where: { userID: 'Engineer1' },
      update: {},
      create: {
        userID: 'Engineer1',
        name: 'ช่างเอก',
        passwordHash: teamPasswordHash,
        role: 'ENGINEERING',
      },
    }),
    prisma.user.upsert({
      where: { userID: 'Engineer2' },
      update: {},
      create: {
        userID: 'Engineer2',
        name: 'ช่างโบ',
        passwordHash: teamPasswordHash,
        role: 'ENGINEERING',
      },
    }),
    prisma.user.upsert({
      where: { userID: 'SuperEngineer1' },
      update: {},
      create: {
        userID: 'SuperEngineer1',
        name: 'หัวหน้าช่างกิต',
        passwordHash: teamPasswordHash,
        role: 'SUPER_ENGINEERING',
      },
    }),
    prisma.user.upsert({
      where: { userID: 'Sales1' },
      update: {},
      create: {
        userID: 'Sales1',
        name: 'ฝ่ายขายนุช',
        passwordHash: teamPasswordHash,
        role: 'SALES',
      },
    }),
  ])

  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000)
  const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 3600 * 1000)
  const hoursToSeconds = (h: number) => Math.round(h * 3600)

  const teamJobs = [
    {
      title: 'เครื่องสำรองไฟดับกะทันหัน',
      description: 'UPS ที่ห้องเซิร์ฟเวอร์ตัดไฟเองโดยไม่มีสัญญาณเตือน',
      type: 'WARRANTY' as const,
      status: 'NEW' as const,
      remark: 'รอนัดหมายลูกค้า',
      customerId: childCustomer.id,
      reporterId: engineer1.id,
      assigneeIds: [engineer1.id],
      reportedAt: hoursAgo(3),
    },
    {
      title: 'จอแสดงผลกระพริบเป็นระยะ',
      description: 'จอมอนิเตอร์ที่แผนกบัญชีภาพกระพริบเมื่อใช้งานนานๆ',
      type: 'WARRANTY' as const,
      status: 'IN_PROGRESS' as const,
      remark: 'กำลังตรวจสอบสาเหตุ',
      customerId: childCustomer.id,
      reporterId: admin.id,
      assigneeIds: [engineer1.id],
      reportedAt: hoursAgo(4),
      startedAt: hoursAgo(3),
      currentSegmentStartedAt: hoursAgo(3),
      workedSeconds: 0,
    },
    {
      title: 'เปลี่ยนอะไหล่เมนบอร์ดตามประกัน',
      description: 'อะไหล่มาถึงแล้ว เข้าเปลี่ยนตามนัด',
      type: 'WARRANTY' as const,
      status: 'COMPLETED' as const,
      remark: 'เปลี่ยนเสร็จ ทดสอบเครื่องผ่านแล้ว',
      customerId: otherCustomer.id,
      reporterId: engineer2.id,
      assigneeIds: [engineer2.id],
      reportedAt: daysAgo(6),
      startedAt: daysAgo(5),
      completedAt: daysAgo(4),
      workedSeconds: hoursToSeconds(2.75),
    },
    {
      title: 'ตรวจสอบระบบเครือข่ายภายในสาขา',
      description: 'ลูกค้าแจ้งอินเทอร์เน็ตช้าเป็นบางช่วง',
      type: 'WARRANTY' as const,
      status: 'ON_HOLD' as const,
      remark: 'รอฝ่าย IT ลูกค้าเปิดสิทธิ์เข้าห้องเน็ตเวิร์ก',
      customerId: parentCustomer.id,
      reporterId: admin.id,
      assigneeIds: [superEngineer1.id],
      reportedAt: daysAgo(3),
      startedAt: daysAgo(2),
      workedSeconds: hoursToSeconds(1.33),
    },
    {
      title: 'ลูกค้าเปลี่ยนใจไม่เคลมประกัน',
      description: 'ลูกค้าตัดสินใจซื้อเครื่องใหม่แทนการเคลม',
      type: 'WARRANTY' as const,
      status: 'CANCELLED' as const,
      remark: 'ปิดงานตามคำขอลูกค้า',
      customerId: childCustomer.id,
      reporterId: engineer1.id,
      assigneeIds: [engineer1.id],
      reportedAt: daysAgo(2),
    },
    {
      title: 'ตรวจเช็คเครื่องปรับอากาศห้องเซิร์ฟเวอร์',
      description: 'บำรุงรักษาตามสัญญา MA ประจำเดือน',
      type: 'MA_SERVICE' as const,
      status: 'NEW' as const,
      typeOther: 'PM',
      remark: 'นัดหมายลูกค้าสัปดาห์หน้า',
      customerId: parentCustomer.id,
      reporterId: engineer2.id,
      assigneeIds: [engineer2.id],
      reportedAt: hoursAgo(6),
    },
    {
      title: 'ตรวจเช็คระบบสำรองข้อมูลประจำไตรมาส',
      description: 'ตรวจสอบว่า backup job รันสำเร็จครบทุกวัน',
      type: 'MA_SERVICE' as const,
      status: 'IN_PROGRESS' as const,
      typeOther: 'PM',
      remark: 'กำลังตรวจสอบ log ย้อนหลัง',
      customerId: childCustomer.id,
      reporterId: admin.id,
      assigneeIds: [superEngineer1.id],
      reportedAt: hoursAgo(1),
      startedAt: hoursAgo(1),
      currentSegmentStartedAt: hoursAgo(1),
      workedSeconds: 0,
    },
    {
      title: 'ซ่อมเครื่องพิมพ์ตามรอบบำรุงรักษา',
      description: 'ทำความสะอาดหัวพิมพ์และเปลี่ยนอะไหล่สึกหรอ',
      type: 'MA_SERVICE' as const,
      status: 'COMPLETED' as const,
      typeOther: 'CM, PM',
      remark: 'ซ่อมและบำรุงรักษาเสร็จเรียบร้อย',
      customerId: otherCustomer.id,
      reporterId: engineer1.id,
      assigneeIds: [engineer1.id, superEngineer1.id],
      reportedAt: daysAgo(4),
      startedAt: daysAgo(3),
      completedAt: daysAgo(3),
      workedSeconds: hoursToSeconds(3),
    },
    {
      title: 'บำรุงรักษาระบบสำรองไฟประจำปี',
      description: 'ตรวจสอบแบตเตอรี่และทดสอบโหลดเทียม',
      type: 'MA_SERVICE' as const,
      status: 'COMPLETED' as const,
      typeOther: 'PM',
      remark: 'ทดสอบผ่านทุกรายการ',
      customerId: parentCustomer.id,
      reporterId: engineer2.id,
      assigneeIds: [engineer2.id],
      reportedAt: daysAgo(7),
      startedAt: daysAgo(6),
      completedAt: daysAgo(6),
      workedSeconds: hoursToSeconds(3.5),
    },
    {
      title: 'ตรวจสอบระบบกล้องวงจรปิด',
      description: 'กล้องบางตัวภาพไม่ชัดตามรอบ MA',
      type: 'MA_SERVICE' as const,
      status: 'ON_HOLD' as const,
      typeOther: 'CM',
      remark: 'รออะไหล่เลนส์กล้อง',
      customerId: childCustomer.id,
      reporterId: admin.id,
      assigneeIds: [engineer2.id],
      reportedAt: daysAgo(2),
      startedAt: daysAgo(1),
      workedSeconds: hoursToSeconds(0.83),
    },
    {
      title: 'ลูกค้าโทรแจ้งคอมพิวเตอร์เปิดไม่ติด',
      description: 'รอตรวจสอบเบื้องต้นทางโทรศัพท์',
      type: 'PERCALL' as const,
      status: 'NEW' as const,
      remark: 'รอช่างติดต่อกลับ',
      customerId: otherCustomer.id,
      reporterId: superEngineer1.id,
      assigneeIds: [superEngineer1.id],
      reportedAt: hoursAgo(2),
    },
    {
      title: 'ลูกค้าแจ้งเสียงดังจากเครื่องสแกนเนอร์',
      description: 'เข้าตรวจสอบหน้างานตามคำขอ',
      type: 'PERCALL' as const,
      status: 'IN_PROGRESS' as const,
      remark: 'กำลังเข้างานที่ไซต์ลูกค้า',
      customerId: childCustomer.id,
      reporterId: engineer1.id,
      assigneeIds: [engineer1.id],
      reportedAt: hoursAgo(1),
      startedAt: hoursAgo(1),
      currentSegmentStartedAt: hoursAgo(1),
      workedSeconds: 0,
    },
    {
      title: 'ซ่อมเครื่องคอมพิวเตอร์ค้างบ่อย',
      description: 'ตรวจพบฮาร์ดดิสก์ใกล้เสีย แนะนำเปลี่ยน SSD',
      type: 'PERCALL' as const,
      status: 'COMPLETED' as const,
      remark: 'เปลี่ยน SSD และย้ายข้อมูลเรียบร้อย',
      customerId: parentCustomer.id,
      reporterId: superEngineer1.id,
      assigneeIds: [superEngineer1.id],
      reportedAt: daysAgo(2),
      startedAt: daysAgo(1),
      completedAt: daysAgo(1),
      workedSeconds: hoursToSeconds(1.08),
    },
    {
      title: 'ติดตั้งเครื่องพิมพ์เพิ่มเติมตามคำขอเร่งด่วน',
      description: 'ลูกค้าขอให้เข้าไปติดตั้งเครื่องพิมพ์สำรอง',
      type: 'PERCALL' as const,
      status: 'COMPLETED' as const,
      remark: 'ติดตั้งและทดสอบพิมพ์เรียบร้อย',
      customerId: otherCustomer.id,
      reporterId: engineer1.id,
      assigneeIds: [engineer1.id],
      reportedAt: daysAgo(4),
      startedAt: daysAgo(3),
      completedAt: daysAgo(3),
      workedSeconds: hoursToSeconds(0.92),
    },
    {
      title: 'ลูกค้ายกเลิกเพราะแก้ปัญหาเองได้',
      description: 'รีสตาร์ทเครื่องแล้วใช้งานได้ปกติ',
      type: 'PERCALL' as const,
      status: 'CANCELLED' as const,
      remark: 'ลูกค้าโทรมายกเลิกก่อนช่างถึง',
      customerId: childCustomer.id,
      reporterId: engineer2.id,
      assigneeIds: [engineer2.id],
      reportedAt: daysAgo(1),
    },
    {
      title: 'ขอคำปรึกษาเรื่องอัปเกรดระบบ',
      description: 'ลูกค้าสอบถามแนวทางอัปเกรดเซิร์ฟเวอร์เก่า',
      type: 'OTHER' as const,
      status: 'NEW' as const,
      typeOther: 'ให้คำปรึกษาอัปเกรดระบบ',
      remark: 'รอทำใบเสนอราคา',
      customerId: parentCustomer.id,
      reporterId: engineer2.id,
      assigneeIds: [engineer2.id],
      reportedAt: hoursAgo(5),
    },
    {
      title: 'ย้ายข้อมูลขึ้นระบบสำรองบนคลาวด์',
      description: 'ลูกค้าขอบริการย้ายข้อมูลนอกเหนือสัญญา',
      type: 'OTHER' as const,
      status: 'COMPLETED' as const,
      typeOther: 'ย้ายข้อมูลขึ้นคลาวด์',
      remark: 'ย้ายข้อมูลและทดสอบกู้คืนสำเร็จ',
      customerId: childCustomer.id,
      reporterId: superEngineer1.id,
      assigneeIds: [superEngineer1.id],
      reportedAt: daysAgo(6),
      startedAt: daysAgo(5),
      completedAt: daysAgo(5),
      workedSeconds: hoursToSeconds(2.33),
    },
    {
      title: 'อบรมการใช้งานระบบเบื้องต้นให้พนักงานลูกค้า',
      description: 'ลูกค้าขอให้สอนการใช้งานเครื่องใหม่',
      type: 'OTHER' as const,
      status: 'ON_HOLD' as const,
      typeOther: 'อบรมการใช้งาน',
      remark: 'รอลูกค้านัดวันที่พนักงานพร้อม',
      customerId: otherCustomer.id,
      reporterId: engineer1.id,
      assigneeIds: [engineer1.id],
      reportedAt: daysAgo(1),
      startedAt: hoursAgo(12),
      workedSeconds: hoursToSeconds(0.5),
    },
    {
      title: 'ตรวจเช็คระบบเครือข่ายและซ่อมจุดที่ชำรุด',
      description: 'งาน MA ที่พบปัญหาสายแลนชำรุดระหว่างตรวจเช็ค',
      type: 'MA_SERVICE' as const,
      status: 'COMPLETED' as const,
      typeOther: 'CM, PM',
      remark: 'เปลี่ยนสายแลนจุดที่ชำรุดและตรวจเช็คครบตามรอบ',
      customerId: parentCustomer.id,
      reporterId: admin.id,
      assigneeIds: [engineer1.id, engineer2.id],
      reportedAt: daysAgo(3),
      startedAt: daysAgo(3),
      completedAt: daysAgo(3),
      workedSeconds: hoursToSeconds(3.17),
    },
    {
      title: 'เครื่องสำรองไฟไม่จ่ายไฟตอนไฟดับจริง',
      description: 'ทดสอบระบบไฟฟ้าสำรองตามประกัน',
      type: 'WARRANTY' as const,
      status: 'IN_PROGRESS' as const,
      remark: 'กำลังทดสอบระบบที่หน้างาน',
      customerId: otherCustomer.id,
      reporterId: engineer2.id,
      assigneeIds: [engineer2.id],
      reportedAt: hoursAgo(1),
      startedAt: hoursAgo(0.75),
      currentSegmentStartedAt: hoursAgo(0.75),
      workedSeconds: 0,
    },
  ]

  for (const { assigneeIds, ...jobData } of teamJobs) {
    const existingJob = await prisma.serviceJob.findFirst({
      where: { title: jobData.title },
    })
    if (!existingJob) {
      const jobNo = await generateJobNo(prisma)
      await prisma.serviceJob.create({
        data: {
          jobNo,
          assignees: { create: assigneeIds.map((userId) => ({ userId })) },
          ...jobData,
        },
      })
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
