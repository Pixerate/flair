// flair-metal-hash: 378ee069
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    int uStyle;
    float3 uBackground;
    float3 uOcean;
    float3 uLand;
    float3 uArcColor;
    packed_float3 uAtmosphere;
    float uSize;
    float uSpin;
    float uTilt;
    float uDots;
    float uLandAmount;
    int uArcs;
    float uArcSpeed;
    float uGlow;
    uint uDemo;
    float uBackgroundAlpha;
};

constant spvUnsafeArray<float2, 6> _1049 = spvUnsafeArray<float2, 6>({ float2(40.700000762939453125, -74.0), float2(51.5, -0.100000001490116119384765625), float2(35.700000762939453125, 139.6999969482421875), float2(-33.90000152587890625, 151.1999969482421875), float2(-23.5, -46.59999847412109375), float2(25.200000762939453125, 55.299999237060546875) });
constant spvUnsafeArray<int2, 6> _1060 = spvUnsafeArray<int2, 6>({ int2(0, 1), int2(1, 5), int2(5, 2), int2(2, 3), int2(0, 4), int2(4, 1) });

struct flair_globe_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 dragOffset(constant FlairUniforms& _387)
{
    float w = _387.iPointer.w;
    bool _402 = w == 0.0;
    bool _410;
    if (!_402)
    {
        _410 = _387.iClicks[0].w < 0.5;
    }
    else
    {
        _410 = _402;
    }
    if (_410)
    {
        return float2(0.0);
    }
    float2 from = _387.iClicks[0].xy;
    float2 to = _387.iPointer.xy;
    float ease = 1.0;
    if (w < 0.0)
    {
        float released = _387.iTime + w;
        for (int i = 0; i < 32; i++)
        {
            bool _447 = _387.iTrail[i].w > 0.5;
            bool _455;
            if (_447)
            {
                _455 = _387.iTrail[i].z <= released;
            }
            else
            {
                _455 = _447;
            }
            if (_455)
            {
                to = _387.iTrail[i].xy;
                break;
            }
        }
        ease = 1.0 - smoothstep(0.0, 2.0, -w);
    }
    return ((to - from) / float2(_387.iResolution[1u])) * ease;
}

static inline __attribute__((always_inline))
float3x3 viewFrom(thread const float& yaw, thread const float& tilt)
{
    float cy = cos(yaw);
    float sy = sin(yaw);
    float ct = cos(tilt);
    float st = sin(tilt);
    float3x3 y = float3x3(float3(cy, 0.0, -sy), float3(0.0, 1.0, 0.0), float3(sy, 0.0, cy));
    float3x3 x = float3x3(float3(1.0, 0.0, 0.0), float3(0.0, ct, st), float3(0.0, -st, ct));
    return x * y;
}

static inline __attribute__((always_inline))
float2 sphereHit(thread const float3& ro, thread const float3& rd, thread const float& r)
{
    float b = dot(ro, rd);
    float c = dot(ro, ro) - (r * r);
    float h = (b * b) - c;
    if (h < 0.0)
    {
        return float2(1000000000.0, -1000000000.0);
    }
    h = sqrt(h);
    return float2((-b) - h, (-b) + h);
}

static inline __attribute__((always_inline))
float hash13(thread float3& p3)
{
    p3 = fract(p3 * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.zyx + float3(31.31999969482421875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise3(thread const float3& p)
{
    float3 i = floor(p);
    float3 f = fract(p);
    float3 u = (f * f) * (float3(3.0) - (f * 2.0));
    float3 param = i;
    float _149 = hash13(param);
    float3 param_1 = i + float3(1.0, 0.0, 0.0);
    float _156 = hash13(param_1);
    float a = mix(_149, _156, u.x);
    float3 param_2 = i + float3(0.0, 1.0, 0.0);
    float _165 = hash13(param_2);
    float3 param_3 = i + float3(1.0, 1.0, 0.0);
    float _170 = hash13(param_3);
    float b = mix(_165, _170, u.x);
    float3 param_4 = i + float3(0.0, 0.0, 1.0);
    float _179 = hash13(param_4);
    float3 param_5 = i + float3(1.0, 0.0, 1.0);
    float _184 = hash13(param_5);
    float c = mix(_179, _184, u.x);
    float3 param_6 = i + float3(0.0, 1.0, 1.0);
    float _193 = hash13(param_6);
    float3 param_7 = i + float3(1.0);
    float _198 = hash13(param_7);
    float d = mix(_193, _198, u.x);
    return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
}

static inline __attribute__((always_inline))
float fbm3(thread float3& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 6; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float3 param = p;
        sum += (amp * vnoise3(param));
        p = (p * 2.0299999713897705078125) + float3(11.69999980926513671875, 3.099999904632568359375, 7.900000095367431640625);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float landAt(thread const float3& g, constant FlairUniforms& _387)
{
    float3 param = (g * 1.7000000476837158203125) + float3(3.099999904632568359375, 7.400000095367431640625, 1.2999999523162841796875);
    int param_1 = 5;
    float _375 = fbm3(param, param_1);
    float n = _375;
    return n - mix(0.60000002384185791015625, 0.37999999523162841796875, _387.uLandAmount);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 fromLatLong(thread const float2& ll)
{
    float2 r = (ll * 3.1415927410125732421875) / float2(180.0);
    return float3(cos(r.x) * sin(r.y), sin(r.x), cos(r.x) * cos(r.y));
}

static inline __attribute__((always_inline))
float3 project(thread const float3& v, thread const float& f)
{
    return float3((v.xy * f) / float2(3.400000095367431640625 - v.z), v.z);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _387, thread float3x3& view)
{
    float px = 1.0 / _387.iResolution[1u];
    float2 p = (fragCoord - (float2(_387.iResolution[0], _387.iResolution[1]) * 0.5)) * px;
    float f = 1.14999997615814208984375 * _387.uSize;
    float2 drag = dragOffset(_387);
    bool _523 = _387.iPointer.w == 0.0;
    bool _530;
    if (_523)
    {
        _530 = _387.iPointer.z < 0.00999999977648258209228515625;
    }
    else
    {
        _530 = _523;
    }
    bool idle = _530;
    float yaw = (((_387.iTime * _387.uSpin) * float((_387.uDemo != 0u) || (!idle))) + (drag.x * 3.5)) + 0.800000011920928955078125;
    float tilt = fast::clamp((_387.uTilt * 0.60000002384185791015625) - (drag.y * 2.5), -1.2999999523162841796875, 1.2999999523162841796875);
    float param = yaw;
    float param_1 = tilt;
    view = viewFrom(param, param_1);
    float3 ro = float3(0.0, 0.0, 3.400000095367431640625);
    float3 rd = fast::normalize(float3(p, -f));
    float3 param_2 = ro;
    float3 param_3 = rd;
    float param_4 = 1.0;
    float2 hit = sphereHit(param_2, param_3, param_4);
    float closest = length(ro - (rd * dot(ro, rd)));
    float3 col = _387.uBackground + float3(0.02999999932944774627685546875 * (1.0 - length(p)));
    float halo = exp((-fast::max(closest - 1.0, 0.0)) * 9.0) * _387.uGlow;
    float3 sun = float3(-0.565685451030731201171875, 0.42426407337188720703125, 0.707106769084930419921875);
    float pxAngle = (px * 2.400000095367431640625) / f;
    if (hit.x < hit.y)
    {
        float3 pos = ro + (rd * hit.x);
        float3 n = pos;
        float3 g = n * view;
        float facing = fast::max(dot(n, -rd), 0.0);
        float lat = asin(fast::clamp(g.y, -1.0, 1.0));
        float lon = precise::atan2(g.x, g.z);
        if (_387.uStyle == 0)
        {
            float rowStep = 3.1415927410125732421875 / _387.uDots;
            float row = floor((lat + 1.57079637050628662109375) / rowStep);
            float rowLat = ((row + 0.5) * rowStep) - 1.57079637050628662109375;
            float count = fast::max(floor((6.283185482025146484375 * cos(rowLat)) / rowStep), 1.0);
            float lonStep = 6.283185482025146484375 / count;
            float cell = floor((lon + 3.1415927410125732421875) / lonStep);
            float cellLon = ((cell + 0.5) * lonStep) - 3.1415927410125732421875;
            float3 centre = float3(cos(rowLat) * sin(cellLon), sin(rowLat), cos(rowLat) * cos(cellLon));
            float3 param_5 = centre;
            float onLand = step(0.0, landAt(param_5, _387));
            float2 d = float2((lon - cellLon) * cos(lat), lat - rowLat);
            d.x = mod(d.x + 3.1415927410125732421875, 6.283185482025146484375) - 3.1415927410125732421875;
            float aa = pxAngle / fast::max(facing, 0.119999997317790985107421875);
            float dotMask = 1.0 - smoothstep((rowStep * 0.300000011920928955078125) - aa, (rowStep * 0.300000011920928955078125) + aa, length(d));
            dotMask = mix(dotMask, 0.300000011920928955078125, smoothstep(rowStep * 0.25, rowStep * 0.699999988079071044921875, aa));
            float3 body = _387.uOcean * (0.550000011920928955078125 + (0.449999988079071044921875 * facing));
            float light = 0.449999988079071044921875 + (0.550000011920928955078125 * facing);
            col = mix(body, _387.uLand * light, float3(dotMask * onLand));
        }
        else
        {
            float3 param_6 = g;
            float h = landAt(param_6, _387);
            float coast = smoothstep(-0.014999999664723873138427734375, 0.014999999664723873138427734375, h);
            float3 param_7 = g * 9.0;
            int param_8 = 3;
            float _828 = fbm3(param_7, param_8);
            float relief = _828;
            float3 shallow = mix(_387.uOcean * 1.7999999523162841796875, _387.uOcean, float3(smoothstep(-0.119999997317790985107421875, 0.0, -h)));
            float3 land = mix(_387.uLand * 0.800000011920928955078125, mix(_387.uLand, float3(0.550000011920928955078125, 0.449999988079071044921875, 0.300000011920928955078125), float3(0.5)), float3(smoothstep(0.02999999932944774627685546875, 0.1500000059604644775390625, h + (relief * 0.0599999986588954925537109375))));
            float3 surface = mix(shallow, land * (0.800000011920928955078125 + (0.4000000059604644775390625 * relief)), float3(coast));
            float ice = smoothstep(0.819999992847442626953125, 0.89999997615814208984375, abs(g.y) + (relief * 0.07999999821186065673828125));
            surface = mix(surface, float3(0.920000016689300537109375, 0.949999988079071044921875, 1.0), float3(ice));
            float diffuse = fast::max(dot(n, sun), 0.0);
            float3 h2 = fast::normalize(sun - rd);
            float glint = (powr(fast::max(dot(n, h2), 0.0), 140.0) * (1.0 - coast)) * (1.0 - ice);
            col = (surface * (0.0599999986588954925537109375 + (0.939999997615814208984375 * diffuse))) + ((float3(1.0, 0.949999988079071044921875, 0.85000002384185791015625) * glint) * 0.60000002384185791015625);
            float2 param_9 = floor(float2(lon, lat) * 90.0);
            float lights = (step(0.86000001430511474609375, hash12(param_9)) * coast) * (1.0 - ice);
            col += (((float3(1.0, 0.75, 0.4000000059604644775390625) * lights) * smoothstep(0.100000001490116119384765625, -0.1500000059604644775390625, dot(n, sun))) * 0.800000011920928955078125);
            halo *= (0.60000002384185791015625 + (0.4000000059604644775390625 * fast::max(dot(fast::normalize(float3(p, 0.20000000298023223876953125)), sun), 0.0)));
        }
        float rim = powr(1.0 - facing, 3.0);
        col += (((float3(_387.uAtmosphere) * rim) * 0.89999997615814208984375) * _387.uGlow);
        float edge = smoothstep(1.0, 1.0 - (((2.5 * px) * 2.400000095367431640625) / f), closest);
        col = mix(_387.uBackground + (float3(_387.uAtmosphere) * halo), col, float3(edge));
    }
    else
    {
        col += ((float3(_387.uAtmosphere) * halo) * 0.800000011920928955078125);
    }
    float arcs = 0.0;
    float cities = 0.0;
    for (int i = 0; i < 6; i++)
    {
        if (i >= _387.uArcs)
        {
            break;
        }
        float2 param_10 = _1049[_1060[i].x];
        float3 a = fromLatLong(param_10);
        float2 param_11 = _1049[_1060[i].y];
        float3 b = fromLatLong(param_11);
        float span = acos(fast::clamp(dot(a, b), -1.0, 1.0));
        float3 axis = fast::normalize(b - (a * dot(a, b)));
        float period = 3.2000000476837158203125;
        float phase = ((_387.iTime * _387.uArcSpeed) / period) + (float(i) * 0.37000000476837158203125);
        float head = fract(phase) * 1.60000002384185791015625;
        float lift = 0.119999997317790985107421875 + ((0.180000007152557373046875 * span) / 3.1415927410125732421875);
        float3 va = view * a;
        float3 vb = view * axis;
        float3 m = view * ((a + b) * 0.5);
        float radius = (fast::max(0.5 * length(a - b), 1.0 - length(m)) + lift) + 0.0199999995529651641845703125;
        float depth = (3.400000095367431640625 - m.z) - radius;
        bool _1161 = depth > 0.0500000007450580596923828125;
        bool _1183;
        if (_1161)
        {
            float3 param_12 = m;
            float param_13 = f;
            _1183 = length(p - project(param_12, param_13).xy) > (((radius * f) / depth) + (40.0 * px));
        }
        else
        {
            _1183 = _1161;
        }
        if (_1183)
        {
            continue;
        }
        float cs = cos(span / 16.0);
        float sn = sin(span / 16.0);
        float2 cw = float2(1.0, 0.0);
        float3 prevV = va * 1.0039999485015869140625;
        float3 param_14 = prevV;
        float param_15 = f;
        float3 prev = project(param_14, param_15);
        float sPrev = 0.0;
        for (int k = 1; k <= 16; k++)
        {
            float s = float(k) / 16.0;
            cw = float2((cw.x * cs) - (cw.y * sn), (cw.y * cs) + (cw.x * sn));
            float3 v = ((va * cw.x) + (vb * cw.y)) * (1.0039999485015869140625 + (lift * sin(3.1415927410125732421875 * s)));
            float3 param_16 = v;
            float param_17 = f;
            float3 cur = project(param_16, param_17);
            float2 e = cur.xy - prev.xy;
            float u = fast::clamp(dot(p - prev.xy, e) / fast::max(dot(e, e), 9.9999999392252902907785028219223e-09), 0.0, 1.0);
            float d_1 = length((p - prev.xy) - (e * u));
            bool hidden = true;
            if (d_1 < (40.0 * px))
            {
                float3 near = mix(prevV, v, float3(u));
                float3 param_18 = ro;
                float3 param_19 = fast::normalize(near - ro);
                float param_20 = 1.0;
                float2 sh = sphereHit(param_18, param_19, param_20);
                bool _1321 = sh.x < sh.y;
                bool _1333;
                if (_1321)
                {
                    _1333 = sh.x < (length(near - ro) - 0.001000000047497451305389404296875);
                }
                else
                {
                    _1333 = _1321;
                }
                hidden = _1333;
            }
            prevV = v;
            if (!hidden)
            {
                float along = mix(sPrev, s, u);
                float tail = smoothstep(head - 0.60000002384185791015625, head, along) * step(along, head);
                float core = 1.0 - smoothstep(0.60000002384185791015625 * px, 1.7999999523162841796875 * px, d_1);
                float glow = exp((-d_1) / (5.0 * px)) * 0.5;
                arcs = fast::max(arcs, ((core + glow) * tail) + (core * 0.119999997317790985107421875));
                float spark = exp((-length(p - mix(prev.xy, cur.xy, float2(fast::clamp((head - sPrev) / (s - sPrev), 0.0, 1.0))))) / (3.5 * px));
                arcs = fast::max(arcs, ((spark * step(sPrev, head)) * step(head, s)) * 1.39999997615814208984375);
            }
            prev = cur;
            sPrev = s;
        }
    }
    for (int i_1 = 0; i_1 < 6; i_1++)
    {
        float2 param_21 = _1049[i_1];
        float3 c = view * fromLatLong(param_21);
        if (c.z < 0.0500000007450580596923828125)
        {
            continue;
        }
        float3 param_22 = c;
        float param_23 = f;
        float3 q = project(param_22, param_23);
        float d_2 = length(p - q.xy);
        float pulse = 0.5 + (0.5 * sin((_387.iTime * 3.0) + float(i_1)));
        cities = fast::max(cities, (1.0 - smoothstep(1.5 * px, 3.0 * px, d_2)) + ((exp((-d_2) / (6.0 * px)) * 0.4000000059604644775390625) * pulse));
    }
    col += (_387.uArcColor * (arcs + cities));
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _1549;
    if (a > 0.0)
    {
        _1549 = bg + (d / float3(a));
    }
    else
    {
        _1549 = bg;
    }
    float3 fg = _1549;
    float alpha = a + (opacity * (1.0 - a));
    float3 _1571;
    if (alpha > 0.0)
    {
        _1571 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _1571 = bg;
    }
    float3 col = _1571;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _387, thread float3x3& view)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _387, view);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _387.uBackground;
    float param_4 = _387.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_globe_frag_out flair_globe_frag(constant FlairUniforms& _387 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_globe_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float3x3 view;
    float _1627;
    if (_387.flair_flipY > 0.5)
    {
        _1627 = _387.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1627 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1627);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _387, view);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

