## Semantic Field Description Rules

Khi sinh mô tả cho một trường dữ liệu, không được chỉ dịch từng token trong tên trường sang tiếng Việt. Mục tiêu là mô tả ý nghĩa nghiệp vụ của trường, không phải diễn giải cú pháp tên cột.

### 1. Nguồn bằng chứng

Suy luận dựa trên toàn bộ thông tin có sẵn, theo thứ tự ưu tiên:

1. Tên bảng và mục đích nghiệp vụ của bảng.
2. Tên trường.
3. Kiểu dữ liệu.
4. Dữ liệu mẫu thực tế đã được phép sử dụng.
5. Các trường đứng cùng bảng.
6. Các nhóm trường có cùng prefix hoặc suffix.
7. PK/FK hoặc quan hệ với bảng khác nếu có.
8. Domain/business context được cung cấp.
9. Thuật ngữ chuẩn của domain khi có đủ bằng chứng.

Không suy luận chỉ từ tên trường nếu còn nguồn context khác.

### 2. Cấm literal translation

Không dùng các mô tả chỉ đổi `_` thành khoảng trắng hoặc dịch từng token, ví dụ `Trường lưu ngày of issue`, `Trường lưu mã payment` hoặc `Trường lưu declared giá trị of carriage`.

Mỗi mô tả phải cố gắng trả lời: giá trị đại diện cho thông tin gì trong nghiệp vụ và được dùng cho vai trò nào nếu xác định được.

### 3. Context khảo sát ngành hàng không

Bộ workbook phục vụ khảo sát metadata dữ liệu trong lĩnh vực hàng không. Khi tên bảng, tài liệu, dữ liệu mẫu hoặc quan hệ cung cấp đủ bằng chứng, ưu tiên thuật ngữ và quy trình phù hợp với nghiệp vụ hàng không. Context này chỉ định hướng cách hiểu; không mặc định một field thuộc một nhóm nghiệp vụ cụ thể nếu nguồn không chứng minh.

Đánh giá field trong mối quan hệ với toàn bộ bảng và tài liệu liên quan. Có thể dùng sự tương đồng về prefix, suffix hoặc thứ tự lặp để giữ mô tả nhất quán khi bằng chứng cho thấy các field có cùng semantic; không tạo nghĩa mới chỉ vì các field có cùng pattern. Nếu abbreviation chưa có đủ bằng chứng để mở rộng, giữ nguyên abbreviation.

### 4. Vai trò của datatype và sample

Datatype và dữ liệu mẫu chỉ là bằng chứng hỗ trợ, không được dùng làm mô tả chính. `NUMBER` có thể là identifier, số lượng, khối lượng, số tiền hoặc tỷ lệ; phải dùng tên field và context để phân biệt. `DATE/TIMESTAMP` cần gắn với sự kiện nghiệp vụ; `Y/N` thường là cờ trạng thái; `VARCHAR` ngắn thường là code/status/category.

Không đưa câu như `dữ liệu mẫu có dạng giá trị số` vào `G. Mô tả`. Có thể dùng pattern của mẫu để chọn nghĩa, nhưng mô tả cuối cùng phải nói field đại diện cho đối tượng hoặc thông tin nghiệp vụ nào.

### 5. Giới hạn

Không suy diễn business rule, công thức, bắt buộc nghiệp vụ, PK/FK hoặc PII chỉ từ tên và mẫu. Khi bằng chứng mâu thuẫn hoặc không đủ để tạo một mô tả semantic hợp lý, ghi `Chưa rõ` và nêu câu hỏi hoặc giới hạn trong `Ghi chú`.
