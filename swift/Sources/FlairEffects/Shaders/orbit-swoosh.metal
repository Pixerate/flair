// flair-metal-hash: de4d75ba
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
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
    float3 uColorA;
    float3 uColorB;
    packed_float3 uConfetti;
    float uRibbons;
    float uSize;
    float uFlatten;
    float uTilt;
    float uLength;
    float uWidth;
    float uGlow;
    float uGap;
    float uConfettiAmount;
    float uSpeed;
    char _m26_pad[12];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_orbit_swoosh_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 orbitOf(thread const int& i, constant FlairUniforms& _127)
{
    float fi = float(i);
    float _137;
    if (i == 1)
    {
        _137 = -0.449999988079071044921875;
    }
    else
    {
        _137 = (i == 2) ? 0.300000011920928955078125 : 0.0;
    }
    float tilt = radians(_127.uTilt) + _137;
    return float3((0.5 * _127.uSize) * (1.0 + (0.07999999821186065673828125 * fi)), fast::min(_127.uFlatten * (1.0 + (0.300000011920928955078125 * fi)), 1.0), tilt);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float2 orbitPoint(thread const float3& o, thread const float& a)
{
    float2 q = float2(cos(a), sin(a) * o.y) * o.x;
    float c = cos(o.z);
    float s = sin(o.z);
    return float2((c * q.x) - (s * q.y), (s * q.x) + (c * q.y));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _127)
{
    float px = 1.0 / _127.iResolution[1u];
    float2 p = (fragCoord - (float2(_127.iResolution[0], _127.iResolution[1]) * 0.5)) * px;
    float w = _127.uWidth * 0.001000000047497451305389404296875;
    int n = int(_127.uRibbons + 0.5);
    float gapR = (_127.uGap * 0.5) * _127.uSize;
    float inGap = 1.0 - smoothstep(0.85000002384185791015625 * gapR, 1.10000002384185791015625 * gapR, length(p * float2(1.0, 1.7999999523162841796875)));
    float4 acc = float4(float3(_127.uBackground) * _127.uBackgroundAlpha, _127.uBackgroundAlpha);
    float3 _301;
    float3 _310;
    for (int i = 0; i < 3; i++)
    {
        if (i >= n)
        {
            break;
        }
        int param = i;
        float3 o = orbitOf(param, _127);
        if (i == 0)
        {
            _301 = _127.uColorA;
        }
        else
        {
            if (i == 1)
            {
                _310 = _127.uColorB;
            }
            else
            {
                _310 = mix(_127.uColorA, _127.uColorB, float3(0.5));
            }
            _301 = _310;
        }
        float3 c = _301;
        float3 hot = mix(c, float3(1.0), float3(0.60000002384185791015625));
        float co = cos(o.z);
        float so = sin(o.z);
        float2 q = float2((co * p.x) + (so * p.y), ((-so) * p.x) + (co * p.y));
        float2 e = q / float2(o.x, o.x * o.y);
        float L = fast::max(length(e), 9.9999997473787516355514526367188e-05);
        float phi = precise::atan2(e.y, e.x);
        float d = abs(L - 1.0) / fast::max(length(e / float2(o.x, o.x * o.y)) / L, 9.9999997473787516355514526367188e-05);
        float head = 6.28318023681640625 * ((_127.iTime * _127.uSpeed) + (float(i) / float(n)));
        float behind = mod(head - phi, 6.28318023681640625) / 6.28318023681640625;
        float k = fast::clamp(1.0 - (behind / _127.uLength), 0.0, 1.0);
        float front = smoothstep(-0.25, 0.25, -sin(phi));
        float vis = front + (((1.0 - front) * 0.550000011920928955078125) * (1.0 - inGap));
        float hw = (0.5 * w) * (0.20000000298023223876953125 + (0.800000011920928955078125 * k));
        float core = (1.0 - smoothstep(hw, hw + (1.5 * px), d)) * step(0.001000000047497451305389404296875, k);
        float halo = ((exp((-d) / (2.5 * w)) * k) * k) * _127.uGlow;
        float4 param_1 = acc;
        float3 param_2 = c;
        float param_3 = fast::clamp((0.60000002384185791015625 * vis) * halo, 0.0, 1.0);
        acc = over(param_1, param_2, param_3);
        float4 param_4 = acc;
        float3 param_5 = mix(c, hot, float3(k));
        float param_6 = fast::clamp((vis * core) * (0.3499999940395355224609375 + (0.64999997615814208984375 * k)), 0.0, 1.0);
        acc = over(param_4, param_5, param_6);
        float3 param_7 = o;
        float param_8 = head;
        float2 hp = orbitPoint(param_7, param_8);
        float hf = smoothstep(-0.25, 0.25, -sin(head));
        float hv = hf + (((1.0 - hf) * 0.550000011920928955078125) * (1.0 - smoothstep(0.85000002384185791015625 * gapR, 1.10000002384185791015625 * gapR, length(hp * float2(1.0, 1.7999999523162841796875)))));
        float dh = length(p - hp);
        float4 param_9 = acc;
        float3 param_10 = c;
        float param_11 = fast::clamp(((0.5 * hv) * exp((-dh) / (4.0 * w))) * _127.uGlow, 0.0, 1.0);
        acc = over(param_9, param_10, param_11);
        float4 param_12 = acc;
        float3 param_13 = float3(1.0);
        float param_14 = fast::clamp((1.60000002384185791015625 * hv) * exp((-dh) / (0.89999997615814208984375 * w)), 0.0, 1.0);
        acc = over(param_12, param_13, param_14);
    }
    float3 _774;
    float3 _785;
    for (int i_1 = 0; i_1 < 24; i_1++)
    {
        float fi = float(i_1);
        float2 param_15 = float2(fi * 7.13000011444091796875, 1.7000000476837158203125);
        float2 seed = hash22(param_15);
        if (seed.x > _127.uConfettiAmount)
        {
            continue;
        }
        float life = (_127.iTime / (1.39999997615814208984375 + seed.y)) + (seed.x * 5.0);
        float cycle = floor(life);
        float age = life - cycle;
        float2 param_16 = float2((fi * 3.099999904632568359375) + (cycle * 17.299999237060546875), 9.19999980926513671875);
        float2 h = hash22(param_16);
        int param_17 = int(mod(fi, float(n)));
        float3 param_18 = orbitOf(param_17, _127);
        float param_19 = h.x * 6.28318023681640625;
        float2 born = orbitPoint(param_18, param_19);
        float2 pos = (born + (((fast::normalize(born + float2(9.9999997473787516355514526367188e-05)) * 0.119999997317790985107421875) + ((h - float2(0.5)) * 0.100000001490116119384765625)) * age)) - float2(0.0, (0.070000000298023223876953125 * age) * age);
        float spin = (h.y * 6.28318023681640625) + (age * (4.0 + (6.0 * h.x)));
        float2 r = p - pos;
        r = float2((cos(spin) * r.x) - (sin(spin) * r.y), (sin(spin) * r.x) + (cos(spin) * r.y));
        float2 size = (float2(0.006000000052154064178466796875, 0.002199999988079071044921875) * (0.699999988079071044921875 + (0.60000002384185791015625 * h.x))) * (0.5 + (0.5 * _127.uSize));
        float2 bd = abs(r) - size;
        float box = length(fast::max(bd, float2(0.0))) + fast::min(fast::max(bd.x, bd.y), 0.0);
        float fade = smoothstep(0.0, 0.07999999821186065673828125, age) * (1.0 - smoothstep(0.550000011920928955078125, 1.0, age));
        float a = fast::clamp(0.5 - (box / px), 0.0, 1.0) * fade;
        if (h.y < 0.5)
        {
            _774 = float3(_127.uConfetti);
        }
        else
        {
            if (h.y < 0.75)
            {
                _785 = _127.uColorA;
            }
            else
            {
                _785 = _127.uColorB;
            }
            _774 = _785;
        }
        float3 fc = _774;
        float4 param_20 = acc;
        float3 param_21 = fc;
        float param_22 = a;
        acc = over(param_20, param_21, param_22);
    }
    float4 param_23 = acc;
    fragColor = unpremultiply(param_23);
}

fragment flair_orbit_swoosh_frag_out flair_orbit_swoosh_frag(constant FlairUniforms& _127 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_orbit_swoosh_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _819;
    if (_127.flair_flipY > 0.5)
    {
        _819 = _127.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _819 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _819);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _127);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

