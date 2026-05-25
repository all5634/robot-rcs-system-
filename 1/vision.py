import cv2
import time

cap = cv2.VideoCapture(0)

robot_state = "FORWARD"

turn_start_time = None

while True:

    ret, frame = cap.read()

    if not ret:
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    _, thresh = cv2.threshold(
        gray,
        60,
        255,
        cv2.THRESH_BINARY_INV
    )

    contours, _ = cv2.findContours(
        thresh,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    obstacle = False

    for cnt in contours:

        area = cv2.contourArea(cnt)

        if area > 5000:

            obstacle = True

            x, y, w, h = cv2.boundingRect(cnt)

            cv2.rectangle(
                frame,
                (x, y),
                (x+w, y+h),
                (0, 0, 255),
                2
            )

    # 状态机逻辑
    if robot_state == "FORWARD":

        if obstacle:

            robot_state = "TURN LEFT"

            turn_start_time = time.time()

            print("检测到障碍 → 开始左转")

    elif robot_state == "TURN LEFT":

        # 左转2秒
        if time.time() - turn_start_time > 2:

            robot_state = "AVOIDING"

            turn_start_time = time.time()

            print("进入绕障状态")

    elif robot_state == "AVOIDING":

        # 绕障3秒后恢复前进
        if time.time() - turn_start_time > 3:

            robot_state = "FORWARD"

            print("恢复直行")

    # 状态显示
    cv2.putText(
        frame,
        f"State: {robot_state}",
        (50, 50),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (255,0,0),
        2
    )

    cv2.imshow("Robot Vision", frame)

    if cv2.waitKey(1) == 27:
        break

cap.release()
cv2.destroyAllWindows()