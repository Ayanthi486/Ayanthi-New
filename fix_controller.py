import re

with open('apps/api/src/attachments/attachments.controller.ts', 'r') as f:
    content = f.read()

content = content.replace('    import { Body } from "@nestjs/common";\n', '')
if 'Body,' not in content:
    content = content.replace('  Controller,\n', '  Body,\n  Controller,\n')

with open('apps/api/src/attachments/attachments.controller.ts', 'w') as f:
    f.write(content)


with open('apps/api/src/attachments/attachments.service.ts', 'r') as f:
    content = f.read()

# Make sure category is used in prisma create
if 'category,' not in content.split('prisma.shipmentAttachment.create')[1]:
    content = content.replace('size: file.buffer.length,\n', 'size: file.buffer.length,\n            category,\n')

with open('apps/api/src/attachments/attachments.service.ts', 'w') as f:
    f.write(content)
