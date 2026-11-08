// flair-metal-hash: 27c16dfb
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
    int uCount;
    float uSize;
    float uRise;
    float uLife;
    float uWobble;
    float uThickness;
    float uSwirl;
    float uIridescence;
    float uOpacity;
    uint uDemo;
};

struct flair_soap_bubbles_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 bubbleAt(thread const int& i, thread const float& t, thread float& age, thread float& life, constant FlairUniforms& _229)
{
    float2 param = float2((float(i) * 3.1700000762939453125) + 0.5, 11.30000019073486328125);
    float2 h = hash22(param);
    life = _229.uLife * (0.699999988079071044921875 + (0.60000002384185791015625 * h.x));
    float period = (life + 0.800000011920928955078125) + (1.5 * h.y);
    float local = t + ((h.y * period) * 7.0);
    float k = floor(local / period);
    age = local - (k * period);
    float2 param_1 = float2((float(i) * 1.90999996662139892578125) + (k * 7.36999988555908203125), k + 2.099999904632568359375);
    float2 r = hash22(param_1);
    float aspect = _229.iResolution[0u] / _229.iResolution[1u];
    float radius = _229.uSize * mix(0.0500000007450580596923828125, 0.119999997317790985107421875, r.y * r.y);
    float2 param_2 = (r * 13.1000003814697265625) + float2(0.699999988079071044921875);
    float2 c = float2((0.07999999821186065673828125 + (0.839999973773956298828125 * r.x)) * aspect, 0.100000001490116119384765625 + (0.449999988079071044921875 * hash12(param_2)));
    c.y += (_229.uRise * age);
    c.x += (((0.0500000007450580596923828125 * _229.uWobble) * sin((age * (0.699999988079071044921875 + r.y)) + (r.x * 6.280000209808349609375))) + (0.0199999995529651641845703125 * sin((age * 1.89999997615814208984375) + k)));
    return float4(c, radius * smoothstep(0.0, 0.60000002384185791015625, age), k);
}

static inline __attribute__((always_inline))
float4 clickAt(thread const int& j, thread const bool& demo, constant FlairUniforms& _229)
{
    bool _375 = !demo;
    bool _383;
    if (!_375)
    {
        _383 = _229.iClicks[0].w > 0.5;
    }
    else
    {
        _383 = _375;
    }
    if (_383)
    {
        return _229.iClicks[j];
    }
    float k = floor(_229.iTime / 2.2000000476837158203125) - float(j);
    float tc = k * 2.2000000476837158203125;
    float2 param = float2(k, 5.30000019073486328125);
    int b = int(hash12(param) * float(_229.uCount));
    int param_1 = b;
    float param_2 = tc;
    float param_3;
    float param_4;
    float4 _426 = bubbleAt(param_1, param_2, param_3, param_4, _229);
    float age = param_3;
    float life = param_4;
    float4 at = _426;
    return float4(at.xy * _229.iResolution[1u], tc, 1.0);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _229)
{
    float px = 1.0 / _229.iResolution[1u];
    float2 p = fragCoord * px;
    float4 acc = float4(0.0);
    spvUnsafeArray<float4, 8> clicks;
    for (int j = 0; j < 8; j++)
    {
        int param = j;
        bool param_1 = _229.uDemo != 0u;
        clicks[j] = clickAt(param, param_1, _229);
    }
    float drift = 0.699999988079071044921875 * ((_229.uRise + (0.085000000894069671630859375 * _229.uWobble)) + 0.039999999105930328369140625);
    float far = (((fast::max(_229.uSize * 0.119999997317790985107421875, 0.00999999977648258209228515625) * 3.599999904632568359375) + 0.100000001490116119384765625) + drift) + (2.0 * px);
    float param_4;
    float param_5;
    float param_8;
    float param_9;
    float param_17;
    float param_18;
    for (int i = 0; i < 16; i++)
    {
        if (i >= _229.uCount)
        {
            break;
        }
        int param_2 = i;
        float param_3 = _229.iTime;
        float4 _524 = bubbleAt(param_2, param_3, param_4, param_5, _229);
        float age = param_4;
        float life = param_5;
        float4 b = _524;
        float2 d0 = p - b.xy;
        if (dot(d0, d0) > (far * far))
        {
            continue;
        }
        float birth = _229.iTime - age;
        float popAt = birth + life;
        for (int j_1 = 0; j_1 < 8; j_1++)
        {
            float4 c = clicks[j_1];
            bool _565 = c.w < 0.5;
            bool _573;
            if (!_565)
            {
                _573 = c.z < birth;
            }
            else
            {
                _573 = _565;
            }
            bool _582;
            if (!_573)
            {
                _582 = c.z > _229.iTime;
            }
            else
            {
                _582 = _573;
            }
            bool _590;
            if (!_582)
            {
                _590 = c.z >= popAt;
            }
            else
            {
                _590 = _582;
            }
            if (_590)
            {
                continue;
            }
            int param_6 = i;
            float param_7 = c.z;
            float4 _604 = bubbleAt(param_6, param_7, param_8, param_9, _229);
            float a2 = param_8;
            float l2 = param_9;
            float4 then = _604;
            if ((then.w != b.w) || (a2 >= l2))
            {
                continue;
            }
            if (length((c.xy * px) - then.xy) < ((then.z * 1.0499999523162841796875) + 0.00999999977648258209228515625))
            {
                popAt = c.z;
            }
        }
        if (_229.iTime < popAt)
        {
            float R = b.z;
            float2 d = p - b.xy;
            bool _654 = R < 9.9999997473787516355514526367188e-05;
            bool _667;
            if (!_654)
            {
                _667 = dot(d, d) > ((R * R) * 1.39999997615814208984375);
            }
            else
            {
                _667 = _654;
            }
            if (_667)
            {
                continue;
            }
            float th = precise::atan2(d.y, d.x);
            float fi = float(i);
            float wob = 1.0 + (_229.uWobble * ((0.02500000037252902984619140625 * sin(((3.0 * th) + (_229.iTime * 2.2999999523162841796875)) + fi)) + (0.0199999995529651641845703125 * sin(((2.0 * th) - (_229.iTime * 1.7000000476837158203125)) + (fi * 2.0)))));
            float2 n2 = d / float2(R * wob);
            float r = length(n2);
            float edge = px / R;
            float inside = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r);
            if (inside <= 0.0)
            {
                continue;
            }
            float rr = fast::min(r, 1.0);
            float z = sqrt(1.0 - (rr * rr));
            float sw = ((_229.iTime * 0.25) * _229.uSwirl) + (fi * 1.7000000476837158203125);
            float2 q = (n2 * 1.60000002384185791015625) + (float2(sin(sw), cos(sw * 0.800000011920928955078125)) * 1.2000000476837158203125);
            float2 param_10 = (q * 1.7999999523162841796875) + float2(fi * 3.099999904632568359375);
            float2 param_11 = (q * 3.7000000476837158203125) - (float2(sw, -sw) * 0.60000002384185791015625);
            float flow = vnoise(param_10) + (0.5 * vnoise(param_11));
            float thick = _229.uThickness * ((0.3499999940395355224609375 + (0.550000011920928955078125 * flow)) + (0.300000011920928955078125 * (0.5 - (0.5 * n2.y))));
            float cosT = sqrt(1.0 - ((1.0 - (z * z)) / 1.769999980926513671875));
            float3 film = float3(0.5) - (cos(float3((16.7132587432861328125 * thick) * cosT) / float3(650.0, 532.0, 450.0)) * 0.5);
            film = mix(float3(0.800000011920928955078125), fast::clamp(((film - float3(0.5)) * 1.7000000476837158203125) + float3(0.550000011920928955078125), float3(0.0), float3(1.0)), float3(_229.uIridescence));
            float fres = 0.0599999986588954925537109375 + (0.939999997615814208984375 * powr(1.0 - z, 3.0));
            float3 col = film;
            float a = fast::clamp((0.0599999986588954925537109375 + (0.2199999988079071044921875 * dot(film, float3(0.333000004291534423828125)))) + fres, 0.0, 1.0);
            float rim = smoothstep(0.839999973773956298828125, 0.9900000095367431640625, r);
            col = mix(col, float3(1.0), float3(rim * 0.300000011920928955078125));
            a = fast::max(a, rim * 0.75);
            float2 wq = (n2 - float2(-0.36000001430511474609375, 0.37999999523162841796875)) * (1.0 + (0.5 * dot(n2, n2)));
            wq.x += (0.2199999988079071044921875 * wq.y);
            float2 e = abs(wq) - float2(0.1500000059604644775390625, 0.119999997317790985107421875);
            float box = (length(fast::max(e, float2(0.0))) + fast::min(fast::max(e.x, e.y), 0.0)) - 0.039999999105930328369140625;
            float win = 1.0 - smoothstep((-edge) * 2.0, (edge * 2.0) + 0.01200000010430812835693359375, box);
            float bars = fast::min(smoothstep(0.008000000379979610443115234375, 0.02199999988079071044921875, abs(wq.x)), smoothstep(0.008000000379979610443115234375, 0.02199999988079071044921875, abs(wq.y)));
            win *= mix(0.300000011920928955078125, 1.0, bars);
            float2 s = n2 - float2(0.449999988079071044921875, -0.4799999892711639404296875);
            float glint = exp((-dot(s, s)) / 0.0040000001899898052215576171875) * 0.699999988079071044921875;
            col = mix(col, float3(1.0), float3(fast::clamp(win + glint, 0.0, 1.0)));
            a = fast::max(a, fast::max(win * 0.949999988079071044921875, glint));
            float4 param_12 = acc;
            float3 param_13 = col;
            float param_14 = (a * inside) * _229.uOpacity;
            acc = over(param_12, param_13, param_14);
        }
        else
        {
            float dt = _229.iTime - popAt;
            if (dt > 0.699999988079071044921875)
            {
                continue;
            }
            int param_15 = i;
            float param_16 = popAt;
            float4 _1014 = bubbleAt(param_15, param_16, param_17, param_18, _229);
            float a2_1 = param_17;
            float l2_1 = param_18;
            float4 then_1 = _1014;
            float R_1 = fast::max(then_1.z, 0.00999999977648258209228515625);
            float2 d_1 = p - then_1.xy;
            float reach = (R_1 * 3.599999904632568359375) + 0.100000001490116119384765625;
            if (dot(d_1, d_1) > (reach * reach))
            {
                continue;
            }
            float ringW = (px * 1.5) + (R_1 * 0.02999999932944774627685546875);
            float x = (length(d_1) - (R_1 * (1.0 + (dt * 2.0)))) / ringW;
            float ring = exp((-x) * x) * (1.0 - smoothstep(0.0, 0.180000007152557373046875, dt));
            float4 param_19 = acc;
            float3 param_20 = float3(1.0);
            float param_21 = (ring * 0.800000011920928955078125) * _229.uOpacity;
            acc = over(param_19, param_20, param_21);
            float fade = 1.0 - (dt / 0.699999988079071044921875);
            for (int k = 0; k < 12; k++)
            {
                float2 param_22 = float2(float(k) + (float(i) * 13.0), (then_1.w * 3.2999999523162841796875) + 1.0);
                float2 hh = hash22(param_22);
                float ang = ((float(k) + (hh.x * 0.60000002384185791015625)) / 12.0) * 6.28318023681640625;
                float2 pos = (then_1.xy + ((float2(cos(ang), sin(ang)) * R_1) * (1.0 + (((0.60000002384185791015625 + hh.y) * dt) * 2.2000000476837158203125)))) - float2(0.0, (0.5 * dt) * dt);
                float dr = (((R_1 * 0.0500000007450580596923828125) * (0.60000002384185791015625 + hh.y)) * fade) + px;
                float drop = 1.0 - smoothstep(dr - px, dr + px, length(p - pos));
                float3 tint = float3(0.5) + (cos((float3(hh.x) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
                float4 param_23 = acc;
                float3 param_24 = mix(float3(1.0), tint, float3(0.3499999940395355224609375));
                float param_25 = (drop * _229.uOpacity) * fade;
                acc = over(param_23, param_24, param_25);
            }
        }
    }
    float4 param_26 = acc;
    fragColor = unpremultiply(param_26);
}

fragment flair_soap_bubbles_frag_out flair_soap_bubbles_frag(constant FlairUniforms& _229 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_soap_bubbles_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1214;
    if (_229.flair_flipY > 0.5)
    {
        _1214 = _229.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1214 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1214);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _229);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

